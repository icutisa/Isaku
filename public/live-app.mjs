import {h,icon,button,linkButton,toast} from './ui.mjs';
import {DAYS,parseRoute,safeMedia,snapshot,normalizeSaved,normalizeHistory,itemURL,catalogURL,choosePlayer,episodeNeighbors} from './live-core.mjs';

const main=document.getElementById('main'), search=document.getElementById('search-input'), dialog=document.getElementById('info-dialog');
const key='cutsaplay.anichin.v1.';
const read=name=>{try{return JSON.parse(localStorage.getItem(key+name));}catch{return null;}};
const write=(name,value)=>{try{localStorage.setItem(key+name,JSON.stringify(value));return true;}catch{return false;}};
let favorites=normalizeSaved(read('favorites')),history=normalizeHistory(read('history'));
let route=parseRoute(location.hash),requestId=0,feature=0,homeData=null,playback=null;
const today=new Intl.DateTimeFormat('id-ID',{weekday:'long',timeZone:'Asia/Jakarta'}).format(new Date());
const dataCache=new Map();

async function api(path) {
  const cached=dataCache.get(path);
  if(cached&&cached.until>Date.now())return cached.value;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),26000);
  try {
    const response=await fetch('/api/anichin/'+path,{signal:controller.signal,headers:{Accept:'application/json'}});
    if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Sesi situs berakhir. Muat ulang halaman untuk masuk kembali.');
    const data=await response.json();
    if(!response.ok||data.error)throw new Error(data.error||'Data Anichin belum dapat dimuat.');
    if(dataCache.size>=100)dataCache.delete(dataCache.keys().next().value);
    dataCache.set(path,{value:data,until:Date.now()+60000});return data;
  } catch(error) {if(error.name==='AbortError')throw new Error('Anichin terlalu lama merespons. Silakan coba lagi.');throw error;}
  finally {clearTimeout(timer);}
}
function go(hash){if(location.hash===hash)render();else location.hash=hash;}
function posterImage(src,title='',className='',size={width:320,height:480}) {
  const img=h('img',{src:safeMedia(src)||'/assets/immortal.webp',alt:title,loading:'lazy',decoding:'async',width:size.width,height:size.height,class:className});
  img.addEventListener('error',()=>{if(!img.dataset.fallback){img.dataset.fallback='1';img.src='/assets/immortal.webp';}});return img;
}
function sectionHead(title,subtitle,action){return h('div',{class:'section-head'},h('div',{},h('h2',{},title),subtitle?h('p',{},subtitle):null),action);}
function pageHead(title,description,kicker='Jelajahi CutsaPlay'){return h('div',{class:'page-header'},h('p',{class:'eyebrow'},kicker),h('h1',{},title),h('p',{},description));}
function empty(title,description,symbol='search'){return h('div',{class:'empty-state'},icon(symbol),h('h2',{},title),h('p',{},description),linkButton('Jelajahi katalog','#/katalog','btn btn-primary','play'));}
function grid(items,full=false){return h('div',{class:'poster-grid'+(full?' full-grid':'')},items.map(poster));}
function toggleSave(item){
  const value=snapshot(item);if(!value)return;
  const saved=favorites.some(x=>x.slug===item.slug);
  favorites=saved?favorites.filter(x=>x.slug!==item.slug):[value,...favorites].slice(0,100);
  const persisted=write('favorites',favorites);
  toast(persisted?(saved?'Dihapus dari daftar saya':'Ditambahkan ke daftar saya'):'Tersimpan untuk sesi ini. Penyimpanan perangkat tidak tersedia.');
  document.querySelectorAll('[data-save-id]').forEach(node=>{
    if(node.dataset.saveId!==item.slug)return;
    const active=!saved,compact=node.classList.contains('save-card');
    node.classList.toggle('saved',active);node.setAttribute('aria-pressed',String(active));
    node.setAttribute('aria-label',(active?'Hapus':'Simpan')+' '+item.title);
    node.replaceChildren(icon(active?'check':'plus'));if(!compact)node.append(active?'Tersimpan':'Daftar saya');
  });
  if(route.page==='watchlist')render(false);
}
function saveButton(item,compact=false){
  const saved=favorites.some(x=>x.slug===item.slug);
  return button(compact?'':saved?'Tersimpan':'Daftar saya',{class:(compact?'save-card':'btn btn-soft')+(saved?' saved':''),'data-save-id':item.slug,'aria-pressed':String(saved),'aria-label':(saved?'Hapus':'Simpan')+' '+item.title,onClick:()=>toggleSave(item)},saved?'check':'plus');
}
function poster(item){return h('article',{class:'poster-card'},
  h('div',{class:'cover-wrap'},h('a',{class:'cover-action',href:itemURL(item),'aria-label':'Buka '+(item.headline||item.title)},posterImage(item.thumbnail,item.title),h('span',{class:'cover-play'},icon('play'))),h('span',{class:'type-badge'},item.type||'Donghua'),item.label?h('span',{class:'episode-badge'},item.label):null,saveButton(item,true)),
  h('h3',{},h('a',{href:itemURL(item)},item.title)),h('div',{class:'card-meta'},item.kind==='episode'?'Episode tersedia':(item.status||'Lihat detail')));}
function hero(items){
  const item=items[feature%items.length];
  return h('section',{class:'hero','aria-label':'Donghua pilihan'},
    h('img',{class:'hero-art',src:'/assets/sky.webp',alt:'',width:1672,height:941,fetchpriority:'high'}),
    h('div',{class:'hero-content'},h('span',{class:'hero-kicker'},icon('star'),'PILIHAN ANICHIN'),h('h1',{},item.title),h('div',{class:'hero-meta'},h('b',{},'DONGHUA'),item.label?h('span',{},item.label):null,h('span',{},'Subtitle Indonesia')),h('p',{},'Temukan petualangan berikutnya. Pilih episode dan server video untuk mulai menonton.'),h('div',{class:'hero-actions'},linkButton(item.kind==='episode'?'Tonton episode':'Lihat episode',itemURL(item),'btn btn-primary','play'),saveButton(item))),
    h('span',{class:'demo-tag'},'KATALOG ANICHIN'),h('div',{class:'hero-position'},h('span',{},String(feature%items.length+1).padStart(2,'0')+' / '+String(items.length).padStart(2,'0')),h('div',{class:'hero-dots'},items.map((x,i)=>button('',{class:i===feature%items.length?'active':'','aria-label':'Pilihan '+(i+1)+': '+x.title,'aria-pressed':String(i===feature%items.length),onClick:()=>{feature=i;render(false);}}))),button('',{class:'hero-arrow','aria-label':'Pilihan berikutnya',onClick:()=>{feature=(feature+1)%items.length;render(false);}},'chevron')));
}
function historyDate(value){
  const date=new Date(value);return Number.isFinite(date.getTime())?date:new Date(0);
}
function recentCard(item,variant='compact'){
  const date=historyDate(item.updated),full=variant==='history';
  const dateLabel=date.toLocaleString('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Jakarta'});
  return h('a',{class:'recent-card '+(full?'history-card':'recent-card-compact'),href:itemURL(item),'aria-label':'Tonton lagi '+item.title+(item.episode?', episode '+item.episode:'')},
    posterImage(item.thumbnail,'','recent-poster',{width:72,height:108}),
    h('div',{class:'recent-content'},
      h('span',{class:'recent-episode'},item.episode?'EPISODE '+item.episode:'TERAKHIR DIBUKA'),
      h('h3',{},item.title),
      h('time',{class:'recent-date',datetime:date.toISOString()},icon('clock'),dateLabel)),
    h('span',{class:'recent-action'},h('span',{class:'recent-play'},icon('play')),full?h('span',{class:'recent-play-label'},'Tonton lagi'):null));
}
function sidebar(data){
  const popular=data.results.find(x=>/populer/i.test(x.section))?.cards||data.results[0]?.cards||[];
  const scheduled=data.schedule.find(x=>x.day===today)?.items||[];
  return h('aside',{class:'sidebar'},h('section',{class:'side-panel'},h('h2',{},icon('star'),'Populer di Anichin'),h('div',{class:'recommended'},popular.slice(0,5).map((item,i)=>h('a',{class:'recommend-row',href:itemURL(item)},h('span',{class:'recommend-number'},String(i+1).padStart(2,'0')),posterImage(item.thumbnail,''),h('div',{},h('h3',{},item.title),h('p',{},item.label||item.type)))))),
    h('section',{class:'side-panel today-panel'},h('div',{class:'today-top'},h('h2',{},icon('calendar'),'Jadwal hari ini'),h('span',{},today)),scheduled.slice(0,4).map(item=>h('a',{class:'today-item',href:itemURL(item),style:'display:block'},h('h3',{},item.title))),!scheduled.length?h('p',{class:'muted'},'Belum ada jadwal yang tersedia.'):null,h('a',{href:'#/jadwal',class:'text-button'},'Lihat jadwal lengkap',icon('chevron'))),
    h('section',{class:'note-panel'},icon('bookmark'),h('h3',{},'Cerita favorit, satu tempat.'),h('p',{},'Simpan judul dan episode yang kamu suka pada perangkat ini.'),h('a',{href:'#/koleksi',class:'text-button'},'Buka daftar saya',icon('chevron'))));
}
async function homePage(){
  const data=await api('home');homeData=data;
  const latest=data.results.find(x=>/rilisan/i.test(x.section))||data.results[0];
  const featured=(data.results.find(x=>/populer/i.test(x.section))?.cards||latest.cards).slice(0,4);
  return [hero(featured),h('div',{class:'live-intro'},h('span',{class:'live-dot'}),'Katalog Anichin',h('span',{},'Rilisan dan episode dari sumber terbaru')),
    history.length?h('section',{class:'resume-section'},sectionHead('Terakhir dibuka',null,h('a',{class:'text-button',href:'#/riwayat'},'Riwayat',icon('chevron'))),h('div',{class:'resume-row'},history.slice(0,3).map(item=>recentCard(item)))):null,
    h('div',{class:'home-columns'},h('div',{},sectionHead('Rilisan terbaru','Pilih cerita, lalu mulai menonton.',h('a',{class:'text-button',href:'#/katalog'},'Lihat katalog',icon('chevron'))),grid(latest.cards.slice(0,20)),h('div',{class:'explore-banner'},h('div',{},h('h3',{},'Masih banyak cerita menantimu.'),h('p',{},'Cari judul favorit atau jelajahi katalog Anichin.')),linkButton('Jelajahi katalog','#/katalog','btn','chevron'))),sidebar(data)),
    ...data.results.filter(x=>/movie|rekomendasi/.test(x.section)).slice(0,2).map(x=>h('section',{class:'related-section'},sectionHead(x.heading),grid(x.cards.slice(0,6),true)))];
}
function pagination(data,current){
  if(!data.has_next&&current.number===1)return null;
  return h('nav',{class:'catalog-pagination','aria-label':'Halaman katalog'},current.number>1?linkButton('Sebelumnya',catalogURL({...current,number:current.number-1}),'btn','left'):button('Sebelumnya',{disabled:true},'left'),h('span',{},'Halaman '+current.number),data.has_next&&current.number<200?linkButton('Berikutnya',catalogURL({...current,number:current.number+1}),'btn','chevron'):button('Berikutnya',{disabled:true},'chevron'));
}
async function catalogPage(current){
  const params=new URLSearchParams({page:String(current.number)});
  if(current.query)params.set('q',current.query);else if(current.genre)params.set('genre',current.genre);
  const [data,genres]=await Promise.all([api((current.query?'search':'anime')+'?'+params),api('genres').catch(()=>({results:[]}))]);
  const genreSelect=h('select',{'aria-label':'Genre',disabled:!!current.query,onChange:e=>go(catalogURL({genre:e.target.value}))},h('option',{value:''},'Semua genre'),genres.results.map(x=>h('option',{value:x.slug,selected:x.slug===current.genre},x.name)));
  const filter=h('div',{class:'filter-panel'},h('label',{},'Genre',genreSelect),h('span',{class:'filter-count'},data.results.length+' judul · Halaman '+current.number),current.query?button('Hapus pencarian',{class:'text-button',onClick:()=>{search.value='';go('#/katalog');}}):null);
  return [pageHead(current.query?'Hasil pencarian':'Katalog donghua',current.query?'Hasil untuk “'+current.query+'”':'Temukan cerita dari katalog Anichin.'),filter,data.results.length?grid(data.results,true):empty('Judul belum ditemukan','Coba kata kunci yang lebih singkat atau genre lainnya.'),pagination(data,current)];
}
async function schedulePage(current){
  const data=homeData||await api('home'),day=current.day||(DAYS.includes(today)?today:'Senin'),items=data.schedule.find(x=>x.day===day)?.items||[];
  return [pageHead('Jadwal tayang','Jadwal mingguan dari Anichin. Jam rilis tidak dicantumkan oleh sumber.'),h('div',{class:'days-bar','aria-label':'Pilih hari'},DAYS.map(name=>button(name,{class:'pill'+(name===day?' active':''),'aria-pressed':String(name===day),onClick:()=>go('#/jadwal?hari='+encodeURIComponent(name))}))),h('p',{class:'schedule-info'},icon('info'),'Jadwal dapat berubah mengikuti sumber Anichin.'),items.length?h('div',{class:'schedule-list'},items.map(item=>h('article',{class:'schedule-card live-schedule-card'},h('span',{class:'schedule-symbol'},icon('calendar')),h('div',{},h('p',{class:'time'},day),h('h2',{},item.title)),linkButton('Lihat episode',itemURL(item),'btn','play')))):empty('Belum ada jadwal','Jadwal untuk hari ini belum tersedia di sumber.','calendar')];
}
function watchlistPage(){return [pageHead('Daftar saya',favorites.length+' judul dan episode tersimpan pada perangkat ini.','Koleksi pribadi'),favorites.length?grid(favorites,true):empty('Simpan cerita pertamamu','Tekan tombol + pada poster untuk menambahkannya ke daftar saya.','bookmark')];}
function historyPage(){
  const dayKey=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Jakarta'});
  const currentDay=dayKey.format(new Date()),previousDay=dayKey.format(new Date(Date.now()-86400000));
  const groups=new Map();
  history.forEach(item=>{
    const date=historyDate(item.updated),key=dayKey.format(date);
    if(!groups.has(key))groups.set(key,{label:key===currentDay?'Hari ini':key===previousDay?'Kemarin':date.toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Jakarta'}),items:[]});
    groups.get(key).items.push(item);
  });
  const subtitle=history.length?history.length+' tontonan terakhir, tersimpan di perangkat ini.':'Tontonan terakhir tersimpan di perangkat ini.';
  return [h('section',{class:'history-page'},
    h('div',{class:'history-header'},pageHead('Riwayat tontonan',subtitle,'Perjalanan kamu'),
      history.length?button('Bersihkan riwayat',{class:'clear-history',onClick:()=>{history=[];write('history',history);render(false);toast('Riwayat dibersihkan.');}},'trash'):null),
    history.length?h('div',{class:'history-groups'},[...groups.values()].map(group=>h('section',{class:'history-group'},
      h('div',{class:'history-group-heading'},h('h2',{},group.label),h('span',{},group.items.length+' tontonan')),
      h('div',{class:'history-list'},group.items.map(item=>recentCard(item,'history')))))):
      empty('Petualanganmu belum dimulai','Buka satu episode untuk menyimpannya pada riwayat.','clock'))];
}
function infoCard(result,kind='series'){
  return {slug:result.slug,title:result.name||result.title||'Donghua',headline:result.title,thumbnail:result.thumbnail,kind,status:result.status,type:result.tipe||result.type||'Donghua',label:kind==='episode'?result.title?.match(/Episode\s*\d+(?:\.\d+)?/i)?.[0]||'Episode':''};
}
function episodePanel(result,currentSlug){
  const episodes=result.episode||[],list=h('div',{class:'episode-list'});
  const fill=term=>{const selected=episodes.filter(item=>!term||String(item.episode||'').includes(term)||item.subtitle.toLowerCase().includes(term.toLowerCase()));list.replaceChildren(...selected.map(item=>h('a',{class:'episode-row'+(item.slug===currentSlug?' active':''),href:'#/tonton/'+item.slug,'aria-current':item.slug===currentSlug?'page':null},h('span',{class:'num'},item.episode||'—'),h('div',{},h('h3',{},item.episode?'Episode '+item.episode:item.subtitle),h('p',{},item.date||'Subtitle Indonesia')),item.slug===currentSlug?icon('play'):null)));if(!selected.length)list.append(h('p',{class:'muted episode-empty'},'Episode belum ditemukan.'));};
  fill('');
  return h('section',{class:'episode-panel'},h('div',{class:'episode-panel-head'},h('h2',{},'Daftar episode'),h('p',{},episodes.length+' episode tersedia'),h('input',{type:'search',class:'episode-search',placeholder:'Cari nomor episode…','aria-label':'Cari nomor episode',onInput:e=>fill(e.target.value)})),list,h('div',{class:'episode-cover'},posterImage(result.thumbnail,''),h('div',{},h('h3',{},result.name),h('p',{},result.status||'Donghua'))));
}
function description(result){return h('div',{class:'watch-description'},(result.sinopsis?.paragraphs||[]).map(text=>h('p',{},text)));}
async function seriesPage(current){
  const {result}=await api('info/'+current.slug),item=infoCard(result),first=result.episode[0],latest=result.episode.at(-1);
  return [h('nav',{class:'breadcrumb','aria-label':'Jejak halaman'},h('a',{href:'#/katalog'},'Katalog'),icon('chevron'),h('span',{},item.title)),h('div',{class:'watch-columns series-columns'},h('section',{},h('div',{class:'series-summary'},posterImage(item.thumbnail,item.title),h('div',{},h('p',{class:'eyebrow'},item.type),h('h1',{class:'watch-title'},item.title),h('p',{class:'watch-label'},[result.status,...result.genre,result.rating?'Rating '+result.rating:null].filter(Boolean).join(' · ')),h('div',{class:'hero-actions'},first?linkButton('Mulai episode '+(first.episode||''),'#/tonton/'+first.slug,'btn btn-primary','play'):null,saveButton(item)),latest&&latest!==first?h('a',{class:'text-button',href:'#/tonton/'+latest.slug},'Episode terbaru: '+(latest.episode||latest.subtitle),icon('chevron')):null)),h('h2',{class:'synopsis-title'},'Sinopsis'),description(result),!result.episode.length?empty('Episode belum tersedia','Judul ini belum memiliki episode yang bisa dibaca dari sumber.','info'):null),h('aside',{},episodePanel(result)))];
}
function remember(result,video=null){
  const item=snapshot(infoCard(result,'episode'));if(!item)return;
  const prev=history.find(x=>x.slug===item.slug);
  const record={...item,episode:result.title?.match(/Episode\s*(\d+(?:\.\d+)?)/i)?.[1]||'',root:result.root||result.slug,updated:Date.now(),time:video&&Number.isFinite(video.currentTime)?video.currentTime:prev?.time||0};
  history=[record,...history.filter(x=>x.root!==record.root)].slice(0,30);write('history',history);
}
function savePlayback(){if(playback?.video)remember(playback.result,playback.video);}
async function watchPage(current){
  const {result}=await api('episode/'+current.slug);
  if(current.requestId!==requestId)return [];
  const item=infoCard(result,'episode');
  const players=(result.players||[]).filter(x=>safeMedia(x.url));
  const playerWrap=h('div',{class:'video-wrap'}),openLink=h('a',{class:'text-button',target:'_blank',rel:'noopener noreferrer'},'Buka player',icon('chevron'));
  const message=h('p',{class:'player-help'},'Jika player kosong, pilih server lain atau buka player.');
  function selectPlayer(source){
    savePlayback();playback=null;openLink.href=source.url;
    if(source.kind==='video'){
      const video=h('video',{controls:true,playsinline:true,preload:'metadata',src:source.url,poster:safeMedia(result.thumbnail)||'', 'aria-label':result.title});
      video.addEventListener('loadedmetadata',()=>{const record=history.find(x=>x.slug===result.slug);if(record?.time>0&&record.time<video.duration-2)video.currentTime=record.time;});
      video.addEventListener('pause',savePlayback);video.addEventListener('ended',savePlayback);playback={video,result};playerWrap.replaceChildren(video);
    } else {
      playerWrap.replaceChildren(h('iframe',{src:source.url,title:result.title+' — '+source.name,allow:'fullscreen; autoplay; encrypted-media; picture-in-picture',allowfullscreen:true,referrerpolicy:'no-referrer',sandbox:'allow-scripts allow-same-origin allow-presentation',loading:'eager'}));
    }
    remember(result);
  }
  const selected=choosePlayer(players);
  const select=h('select',{'aria-label':'Pilih server video',onChange:e=>selectPlayer(players[Number(e.target.value)])},players.map((p,i)=>h('option',{value:i,selected:p===selected},p.name)));
  if(selected)selectPlayer(selected);else playerWrap.append(h('div',{class:'unavailable-player'},icon('info'),h('h2',{},'Player belum tersedia'),h('p',{},'Sumber belum menyediakan player yang dapat dibaca untuk episode ini.'),h('a',{href:'https://anichin.moe/'+current.slug+'/',class:'btn',target:'_blank',rel:'noopener noreferrer'},'Lihat halaman sumber')));
  const neighbors=episodeNeighbors(result.episode,current.slug);
  const prev=neighbors.prev?linkButton('Sebelumnya','#/tonton/'+neighbors.prev.slug,'btn','left'):button('Sebelumnya',{disabled:true},'left');
  const next=neighbors.next?linkButton('Berikutnya','#/tonton/'+neighbors.next.slug,'btn','chevron'):button('Berikutnya',{disabled:true},'chevron');
  return [h('nav',{class:'breadcrumb','aria-label':'Jejak halaman'},h('a',{href:'#/'},'Beranda'),icon('chevron'),result.root?h('a',{href:'#/seri/'+result.root},item.title):h('span',{},item.title)),h('div',{class:'watch-columns'},h('section',{},playerWrap,players.length?h('div',{class:'player-toolbar'},h('label',{},'Server video',select),openLink):null,players.length?message:null,h('div',{class:'watch-bar'},h('div',{class:'episode-navigation'},prev,next),saveButton(item)),h('h1',{class:'watch-title'},result.title||item.title),h('p',{class:'watch-label'},result.genre.join(' · ')),description(result),h('p',{class:'source-attribution'},'Sumber: ',h('a',{href:'https://anichin.moe/'+current.slug+'/',target:'_blank',rel:'noopener noreferrer'},'Anichin'))),h('aside',{},episodePanel(result,current.slug)))];
}
function loading(){return [h('div',{class:'loading-view',role:'status','aria-label':'Memuat data Anichin'},h('div',{class:'loading-banner'}),h('p',{},'Memuat data Anichin…'),h('div',{class:'loading-grid'},Array.from({length:6},()=>h('div',{class:'loading-poster'}))))];}
async function render(scroll=true){
  savePlayback();if(playback?.video)playback.video.pause();playback=null;
  const id=++requestId,current=parseRoute(location.hash);route=current;
  search.value=current.page==='catalog'?current.query:'';
  document.querySelectorAll('[data-nav]').forEach(el=>{const active=el.dataset.nav===current.page;el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  document.querySelector('.history-button').classList.toggle('active',current.page==='history');
  main.setAttribute('aria-busy','true');main.replaceChildren(...loading());
  if(scroll)window.scrollTo({top:0,behavior:'instant'});
  const names={home:'Nonton Donghua',catalog:'Katalog',schedule:'Jadwal',watchlist:'Daftar saya',history:'Riwayat',series:'Detail Donghua',watch:'Tonton Episode',missing:'Halaman tidak ditemukan'};
  document.title=(names[current.page]||names.missing)+' — CutsaPlay';
  try{
    const views={home:homePage,catalog:catalogPage,schedule:schedulePage,watchlist:watchlistPage,history:historyPage,series:seriesPage,watch:watchPage,missing:()=>[empty('Halaman tidak ditemukan','Buka katalog untuk memilih judul dan episode yang tersedia.')]};
    const nodes=await views[current.page]({...current,requestId:id});
    if(id!==requestId)return;
    main.replaceChildren(...nodes.filter(Boolean));
  }catch(error){if(id!==requestId)return;main.replaceChildren(h('div',{class:'empty-state api-error',role:'alert'},icon('info'),h('h1',{},'Data belum dapat dimuat'),h('p',{},error.message),button('Coba lagi',{class:'btn btn-primary',onClick:()=>render(false)},'reload'),h('a',{class:'text-button',href:'#/'},'Kembali ke beranda')));}
  finally{if(id===requestId)main.removeAttribute('aria-busy');}
}
document.getElementById('search-form').addEventListener('submit',event=>{event.preventDefault();go(catalogURL({query:search.value.trim()}));search.blur();});
document.addEventListener('keydown',event=>{if(event.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){event.preventDefault();search.focus();}if(event.key==='Escape')search.blur();});
document.getElementById('about-demo').addEventListener('click',()=>{document.getElementById('dialog-content').replaceChildren(h('h2',{id:'dialog-title'},'Tentang CutsaPlay'),h('p',{},'CutsaPlay menampilkan katalog dan pilihan player dari Anichin melalui API komunitas yang disesuaikan untuk domain terbaru.'),h('p',{},'Video diputar oleh server pihak ketiga. Ketersediaan episode, kualitas, dan iklan mengikuti server yang dipilih.'),h('p',{},'Daftar saya dan riwayat disimpan pada perangkat ini.'));dialog.showModal();});
document.getElementById('dialog-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
window.addEventListener('hashchange',()=>render());window.addEventListener('pagehide',savePlayback);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')savePlayback();});
render();
