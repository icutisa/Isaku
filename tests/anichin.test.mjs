import test from 'node:test';
import assert from 'node:assert/strict';
import {ApiError,parseHome,parseCatalog,parseInfo,parseEpisode,parsePlayers,decodeMirrorMarkup,getAnichin,safeURL,pageNumber,validSlug} from '../lib/anichin.mjs';
import {parseRoute,normalizeSaved,normalizeHistory,episodeNeighbors,choosePlayer,catalogURL,safeMedia} from '../public/live-core.mjs';

const player = Buffer.from('<iframe src="https://ok.ru/videoembed/123"></iframe>').toString('base64');
const badPlayer = Buffer.from('<iframe src="javascript:alert(1)"></iframe>').toString('base64');
const series = `<div class="infox"><h1 class="entry-title">Sword Story</h1><div class="spe"><span>Status: Ongoing</span><span>Tipe: Donghua</span></div><div class="genxed"><a>Action</a></div><div class="entry-content" itemprop="description"><p>A journey.</p></div></div><div class="thumb"><img src="/poster.webp"></div><div class="eplister"><ul><li><a href="/sword-story-episode-2/"><div class="epl-num">2</div><div class="epl-title">Sword Story Episode 2</div><div class="epl-date">Today</div></a></li><li><a href="/sword-story-episode-1/"><div class="epl-num">1</div><div class="epl-title">Sword Story Episode 1</div></a></li></ul></div>`;
const episode = series.replace('<h1 class="entry-title">Sword Story</h1>','<h2 itemprop="partOfSeries">Sword Story</h2>') + `<h1 class="entry-title">Sword Story Episode 2</h1><div class="ts-breadcrumb"><a href="/">Home</a><a href="/sword-story/">Sword Story</a></div><select name="mirror"><option>Choose</option><option value="${player}">Okru</option><option value="${badPlayer}">Unsafe</option><option value="${player}">Duplicate</option></select>`;
const card = `<article class="bs"><a title="Sword Story Episode 2" href="/sword-story-episode-2/"><div class="tt">Sword Story<h2>Sword Story Episode 2</h2></div><div class="typez">Donghua</div><span class="epx">Ep 2</span><img src="/poster.webp"></a></article>`;
const home = `<div class="bixbox bbnofrm"><div class="releases"><h2>Rilisan Terbaru</h2><a>Lihat Semua</a></div><div class="listupd">${card}${card}</div></div><div class="schedule"><div class="listSchh"><h2>Jum'at</h2><div class="subSchh"><a href="/anime/sword-story/">Sword Story</a><a href="//my-brother/">My Brother</a></div></div></div><div class="hpage"><a class="r">Next</a></div>`;

test('home separates series titles and episode headlines, resolves relative assets, deduplicates cards',()=>{
  const data=parseHome(home);
  assert.equal(data.results[0].section,'rilisan_terbaru');assert.equal(data.results[0].cards.length,1);
  assert.equal(data.results[0].cards[0].title,'Sword Story');assert.equal(data.results[0].cards[0].kind,'episode');
  assert.equal(data.results[0].cards[0].thumbnail,'https://anichin.moe/poster.webp');assert.equal(data.has_next,true);
  assert.equal(data.schedule[0].day,'Jumat');assert.equal(data.schedule[0].items[1].slug,'my-brother');
});
test('series parser includes real metadata, synopsis, and episodes in ascending order',()=>{
  const data=parseInfo(series,'sword-story').result;
  assert.equal(data.name,'Sword Story');assert.equal(data.status,'Ongoing');assert.deepEqual(data.genre,['Action']);
  assert.deepEqual(data.sinopsis.paragraphs,['A journey.']);assert.deepEqual(data.episode.map(x=>x.episode),['1','2']);
});
test('episode parser keeps parent series and safe player options; ignores invalid and duplicate sources',()=>{
  const data=parseEpisode(episode,'sword-story-episode-2').result;
  assert.equal(data.title,'Sword Story Episode 2');assert.equal(data.root,'sword-story');
  assert.deepEqual(data.players,[{name:'Okru',url:'https://ok.ru/videoembed/123',kind:'embed'}]);
});
test('empty search results differ from an unreadable or blocked page',()=>{
  assert.deepEqual(parseCatalog('<div class="listupd"></div>').results,[]);
  assert.throws(()=>parseCatalog('<h1>Verification needed</h1>'),ApiError);
  assert.throws(()=>parseHome('<h1>Verification needed</h1>'),ApiError);
});
test('mirror data decodes without evaluating remote JavaScript',()=>{
  const html=`<select name="mirror"><option value="${player}">Okru</option></select>`;
  const codes=[...html].map(c=>Buffer.from(String(c.charCodeAt(0)+5)).toString('base64'));
  const encoded=`var chars=${JSON.stringify(codes)}; function x(v){return atob(v)-5;} document.write(decodeURIComponent(escape(result)))`;
  assert.equal(decodeMirrorMarkup(encoded),html);assert.equal(parsePlayers('<script>'+encoded+'</script>')[0].name,'Okru');
  assert.equal(decodeMirrorMarkup(encoded.replace(codes[0]+'"',codes[0]+'", evil()')),'');
});
test('URL validation rejects insecure, credentialed, local, and executable sources',()=>{
  for(const bad of ['javascript:alert(1)','http://ok.ru/x','https://user:pass@ok.ru/x','https://127.0.0.1/x','https://localhost/x','https://[::1]/x']){assert.equal(safeURL(bad),null);assert.equal(safeMedia(bad),null);}
  assert.equal(safeURL('//ok.ru/videoembed/1'),'https://ok.ru/videoembed/1');
});
test('API inputs cannot choose an arbitrary upstream URL or unsafe page number',async()=>{
  for(const bad of ['../secret','https://evil.test/path','a/b','a?b',''])assert.throws(()=>validSlug(bad),ApiError);
  for(const bad of ['0','-1','201','1.5','NaN'])assert.throws(()=>pageNumber(bad),ApiError);
  await assert.rejects(getAnichin('info',['../secret']),{status:400});await assert.rejects(getAnichin('search'),{status:400});
});
test('upstream errors are reported and external redirects are refused',async()=>{
  await assert.rejects(getAnichin('info',['redirect-test'],new URLSearchParams(),async()=>new Response('',{status:302,headers:{location:'http://127.0.0.1/secret'}})),{status:502});
  await assert.rejects(getAnichin('home',[],new URLSearchParams({page:'199'}),async()=>new Response('',{status:403})),{status:502});
});
test('successful public data is cached without repeating the upstream request',async()=>{
  let calls=0;const fetcher=async()=>{calls++;return new Response(series);};
  const one=await getAnichin('info',['cache-test'],new URLSearchParams(),fetcher);
  const two=await getAnichin('info',['cache-test'],new URLSearchParams(),fetcher);
  assert.equal(calls,1);assert.deepEqual(one,two);assert.ok(one.fetched_at);
});
test('routes and query navigation preserve actual episode slugs and filters',()=>{
  assert.equal(parseRoute('#/tonton/sword-story-episode-2').slug,'sword-story-episode-2');
  assert.equal(parseRoute('#/tonton/../secret').page,'missing');assert.equal(parseRoute('#/other').page,'missing');
  assert.deepEqual(parseRoute(catalogURL({query:'sword & story',number:2})),{page:'catalog',slug:undefined,query:'sword & story',number:2,genre:'',day:null});
});
test('favorites and history tolerate corrupt storage, unsafe assets, duplicates, and unavailable video timing',()=>{
  const item={slug:'sword-story',title:'Sword Story',thumbnail:'javascript:x'};
  assert.deepEqual(normalizeSaved({}),[]);assert.equal(normalizeSaved([item,item,null])[0].thumbnail,null);assert.equal(normalizeSaved([item,item]).length,1);
  const history=normalizeHistory([{...item,updated:1,time:-3,root:'sword-story'},{...item,slug:'sword-story-episode-2',updated:2,root:'sword-story'}]);
  assert.equal(history.length,1);assert.equal(history[0].slug,'sword-story-episode-2');assert.equal(history[0].time,0);assert.deepEqual(normalizeHistory([{...item,updated:'broken'}]),[]);
});
test('episode navigation follows the parsed list and player selection prefers Okru',()=>{
  const items=[{slug:'one'},{slug:'two'},{slug:'three'}];assert.deepEqual(episodeNeighbors(items,'two'),{prev:items[0],next:items[2]});assert.equal(episodeNeighbors(items,'missing').next,null);
  const players=[{name:'Video [ADS]'},{name:'Rumble'},{name:'Okru'}];assert.equal(choosePlayer(players),players[2]);assert.equal(choosePlayer([]),null);
});
