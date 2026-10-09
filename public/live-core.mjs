const SLUG = /^[a-z0-9][a-z0-9-]{0,219}$/i;
export const DAYS = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu','Acak'];
export function parseRoute(hash) {
  try {
    const [path,query=''] = String(hash || '#/').replace(/^#/, '').split('?');
    const segments = path.split('/').filter(Boolean), params = new URLSearchParams(query);
    const pages = {katalog:'catalog',jadwal:'schedule',koleksi:'watchlist',riwayat:'history',seri:'series',tonton:'watch'};
    const page = segments.length ? pages[segments[0]] || 'missing' : 'home';
    const slug = segments[1];
    if (segments.length > 2 || (segments.length>1&&!['series','watch'].includes(page)) || (['series','watch'].includes(page) && !SLUG.test(slug ?? ''))) return {page:'missing'};
    const number = Number(params.get('page') || 1);
    return {page,slug,query:(params.get('q') || '').trim().slice(0,100),number:Number.isInteger(number) && number>0 && number<=200 ? number : 1,genre:SLUG.test(params.get('genre') ?? '') ? params.get('genre') : '',day:DAYS.includes(params.get('hari')) ? params.get('hari') : null};
  } catch { return {page:'missing'}; }
}
export function safeMedia(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.') || url.hostname.includes(':') || /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname) || /(^|\.)(local|internal|localhost)$/.test(url.hostname)) return null;
    return url.href;
  } catch { return null; }
}
export function snapshot(item) {
  if (!item || !SLUG.test(item.slug ?? '') || typeof item.title !== 'string') return null;
  return {slug:item.slug,title:item.title.slice(0,240),thumbnail:safeMedia(item.thumbnail),kind:item.kind==='episode'?'episode':'series',label:String(item.label||'').slice(0,100),headline:String(item.headline||'').slice(0,300),status:String(item.status||'').slice(0,100),type:String(item.type||'Donghua').slice(0,50)};
}
export function normalizeSaved(value, limit=100) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.map(snapshot).filter(item => {if(!item || seen.has(item.slug))return false;seen.add(item.slug);return true;}).slice(0,limit);
}
export function normalizeHistory(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.map(record => {
    const item = snapshot(record);
    if(!item || !Number.isFinite(record.updated))return null;
    return {...item,updated:record.updated,time:Number.isFinite(record.time)&&record.time>0?record.time:0,episode:String(record.episode||'').slice(0,20),root:SLUG.test(record.root??'')?record.root:item.slug};
  }).filter(Boolean).sort((a,b)=>b.updated-a.updated).filter(item => {if(seen.has(item.root))return false;seen.add(item.root);return true;}).slice(0,30);
}
export function itemURL(item) { return '#/'+(item.kind==='episode'?'tonton':'seri')+'/'+item.slug; }
export function catalogURL({query='',number=1,genre=''}={}) {
  const params=new URLSearchParams();
  if(query)params.set('q',query);if(number>1)params.set('page',String(number));if(genre)params.set('genre',genre);
  return '#/katalog'+(params.size?'?'+params:'');
}
export function choosePlayer(players) { return players.find(x=>/okru|ok\.ru/i.test(x.name)) || players.find(x=>!/[\[]ads[\]]/i.test(x.name)) || players[0] || null; }
export function episodeNeighbors(episodes,slug) {
  const index=episodes.findIndex(x=>x.slug===slug);
  return {prev:index>0?episodes[index-1]:null,next:index>=0&&index<episodes.length-1?episodes[index+1]:null};
}
