import { load } from 'cheerio/slim';

// Independent parser with response shapes compatible with asmindev/anichin-api.
// Current public domain; no clearance cookies or third-party converters.
export const SOURCE = 'https://anichin.moe';
const cache = new Map(), TTL = 180_000, SLUG = /^[a-z0-9][a-z0-9-]{0,219}$/i;
const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
export class ApiError extends Error {
  constructor(message, status = 502) { super(message); this.status = status; }
}
export function pageNumber(value = '1') {
  if (!/^\d{1,3}$/.test(String(value)) || Number(value) < 1 || Number(value) > 200) throw new ApiError('Halaman tidak valid.', 400);
  return Number(value);
}
export function validSlug(value) {
  if (!SLUG.test(value ?? '')) throw new ApiError('Judul tidak valid.', 400);
  return value;
}
export function safeURL(value, base = SOURCE) {
  if (!value || typeof value !== 'string') return null;
  try {
    const url = new URL(value, base), host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || !host.includes('.') || /(^|\.)(localhost|local|internal)$/.test(host) || host.includes(':') || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return null;
    return url.href;
  } catch { return null; }
}
function slugFrom(value) {
  try {
    const fixed = String(value ?? '').replace(/^\/\/([^/.]+)\//, '/$1/');
    const url = new URL(fixed, SOURCE);
    if (url.hostname !== new URL(SOURCE).hostname) return null;
    const slug = url.pathname.split('/').filter(Boolean).at(-1);
    return SLUG.test(slug ?? '') ? slug : null;
  } catch { return null; }
}
function image($, node) {
  const img = $(node).find('img').first();
  return safeURL(img.attr('data-lazy-src') || img.attr('data-src') || img.attr('src'));
}
function card($, element) {
  const node = $(element), a = node.find('a[title][href], a[href]').first(), slug = slugFrom(a.attr('href')), tt = node.find('.tt').first();
  const headline = clean(tt.find('h2').text() || a.attr('title'));
  const title = clean(tt.contents().filter((_, n) => n.type === 'text').text()) || headline;
  if (!slug || !title) return null;
  const label = clean(node.find('.epx').text());
  return { title, headline, slug, thumbnail: image($, node), type: clean(node.find('.typez').text()) || 'Donghua', status: clean(node.find('.status').first().text()) || label, eps: label.match(/\d+(?:\.\d+)?/)?.[0] ?? null, label, kind: /-episode(?:-|\d)/i.test(slug) ? 'episode' : 'series' };
}
function cards($, elements) {
  const seen = new Set();
  return elements.toArray().map(el => card($, el)).filter(item => {
    if (!item || seen.has(item.slug)) return false;
    seen.add(item.slug); return true;
  });
}
function pagination($, page) { return { page, has_next: $('.hpage .r, .pagination .next, a.next.page-numbers').length > 0 }; }
export function parseSchedule(html) {
  const $ = load(html);
  const results = $('.schedule .listSchh').toArray().map(el => {
    const node = $(el), day = clean(node.find('h2').text()).replace(/^Jum['’]at$/i, 'Jumat');
    const items = node.find('.subSchh a[href]').toArray().map(a => ({ title: clean($(a).text()), slug: slugFrom($(a).attr('href')), kind: 'series' })).filter(x => x.slug && x.title);
    return { day, items };
  }).filter(x => x.day);
  return { results, source: SOURCE };
}
export function parseHome(html, page = 1) {
  const $ = load(html);
  const results = $('.bixbox.bbnofrm').toArray().map(el => {
    const node = $(el), headingNode = node.find('.releases h2, .releases h3').first();
    const heading = clean(headingNode.text() || node.find('.releases').clone().find('a').remove().end().text());
    return { section: heading.toLowerCase().replace(/\s+/g, '_'), heading, cards: cards($, node.find('article.bs')) };
  }).filter(x => x.cards.length);
  if (!results.length) throw new ApiError('Katalog Anichin belum dapat dibaca. Coba lagi sebentar.');
  return { results, ...pagination($, page), total: results.length, schedule: parseSchedule(html).results, source: SOURCE };
}
export function parseCatalog(html, { page = 1, query } = {}) {
  const $ = load(html), results = cards($, $('.bixbox .listupd article.bs'));
  if (!results.length && !$('.listupd, .notfound, .not-found').length) throw new ApiError('Katalog Anichin belum dapat dibaca. Coba lagi sebentar.');
  return { results, total: results.length, ...pagination($, page), ...(query ? { query } : {}), source: SOURCE };
}
function details($, slug) {
  const info = $('.infox').first();
  if (!info.length) throw new ApiError('Informasi judul belum tersedia.', 404);
  const metadata = {};
  info.find('.spe > span').each((_, el) => {
    const text = clean($(el).text()), index = text.indexOf(':');
    if (index > 0) metadata[text.slice(0, index).toLowerCase().replace(/\s+/g, '_')] = text.slice(index + 1).trim();
  });
  const description = info.find('[itemprop="description"], .desc, .entry-content').first();
  const paragraphs = description.find('p').toArray().map(el => clean($(el).text())).filter(Boolean);
  const name = clean(info.find('h1.entry-title, h2[itemprop="partOfSeries"], h1, h2').first().text());
  return { ...metadata, slug, name, thumbnail: image($, $('.thumb').first()) || image($, $('.thumbnail').first()), genre: info.find('.genxed a').toArray().map(el => clean($(el).text())).filter(Boolean), rating: $('[itemprop="ratingValue"]').first().attr('content') || clean($('.rating strong').first().text()).match(/\d+(?:\.\d+)?/)?.[0] || clean($('.numscore').first().text()) || null, sinopsis: { title: clean(description.find('h2').text()), paragraphs: paragraphs.length ? paragraphs : [clean(description.text())].filter(Boolean) } };
}
function episodeRows($, thumbnail) {
  const seen = new Set();
  return $('.eplister li, .episodelist li').toArray().map(el => {
    const node = $(el), a = node.find('a[href]').first(), slug = slugFrom(a.attr('href'));
    const subtitle = clean(node.find('.epl-title, .playinfo h3').text() || a.attr('title'));
    // Some episode-page Eps labels are stale; use the actual title first.
    const episode = subtitle.match(/Episode\s*(\d+(?:\.\d+)?)/i)?.[1] || clean(node.find('.epl-num').text()) || null;
    const date = clean(node.find('.epl-date').text()) || clean(node.find('.playinfo span').text()).replace(/^Eps.*?\s-\s/, '');
    return { slug, subtitle, episode, date, thumbnail: image($, node) || thumbnail };
  }).filter(item => { if (!item.slug || seen.has(item.slug)) return false; seen.add(item.slug); return true; }).sort((a, b) => Number(a.episode ?? 0) - Number(b.episode ?? 0));
}
export function parseInfo(html, slug) {
  const $ = load(html), result = details($, slug);
  result.episode = episodeRows($, result.thumbnail);
  return { result, source: `${SOURCE}/${slug}/` };
}
// Decode inert quoted Base64 literals only. Never execute the source's JS.
export function decodeMirrorMarkup(script) {
  const match = script.match(/var\s+\w+\s*=\s*(\[[^\]]{1,600000}\]);[\s\S]*?\)\s*-\s*(\d{1,7})/);
  if (!match || !script.includes('document.write(decodeURIComponent(escape(')) return '';
  const literals = [...match[1].matchAll(/['"]([A-Za-z0-9+/=]{1,200})['"]/g)];
  const residue = match[1].replace(/['"][A-Za-z0-9+/=]{1,200}['"]/g, '').replace(/[\[\],\s]/g, '');
  if (residue || !literals.length || literals.length > 50_000) return '';
  try {
    return literals.map(value => {
      const digits = atob(value[1]).replace(/\D/g, '');
      if (!digits || digits.length > 8) throw new Error('Invalid character');
      const code = Number(digits) - Number(match[2]);
      if (code < 0 || code > 0xffff) throw new Error('Invalid character');
      return String.fromCharCode(code);
    }).join('');
  } catch { return ''; }
}
export function parsePlayers(html) {
  const $ = load(html), documents = [$], seen = new Set(), players = [];
  $('script').each((_, el) => { const decoded = decodeMirrorMarkup($(el).text()); if (decoded) documents.push(load(decoded)); });
  for (const doc of documents) {
    doc('select[name="mirror"] option, select.mirror option').each((_, el) => {
      const option = doc(el), encoded = option.attr('value');
      if (!encoded || encoded.length > 12000) return;
      try {
        const markup = load(atob(encoded)), raw = markup('iframe').first().attr('src') || markup('video, source').first().attr('src'), url = safeURL(raw);
        if (!url || seen.has(url)) return;
        seen.add(url); players.push({ name: clean(option.text()) || 'Server video', url, kind: markup('iframe').length ? 'embed' : 'video' });
      } catch { /* Ignore non-player options. */ }
    });
  }
  if (!players.length) { const url = safeURL($('#pembed iframe, #embed_holder iframe').first().attr('src')); if (url) players.push({ name: 'Player utama', url, kind: 'embed' }); }
  return players;
}
export function parseEpisode(html, slug) {
  const $ = load(html), result = details($, slug);
  result.title = clean($('h1.entry-title').first().text()) || result.name;
  result.root = slugFrom($('.ts-breadcrumb a').eq(1).attr('href')) || slugFrom($('.year a').last().attr('href'));
  result.episode = episodeRows($, result.thumbnail); result.players = parsePlayers(html);
  return { result, source: `${SOURCE}/${slug}/` };
}
async function upstream(path, fetcher = fetch) {
  let url = new URL(path, SOURCE);
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 18_000);
  try {
    let response;
    for (let i = 0; i < 4; i++) {
      response = await fetcher(url.href, { redirect: 'manual', signal: controller.signal, headers: { 'User-Agent': 'CutsaPlay/1.0', Accept: 'text/html' } });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const next = new URL(response.headers.get('location') ?? '', url);
      if (next.protocol !== 'https:' || next.hostname !== new URL(SOURCE).hostname) throw new ApiError('Alamat sumber Anichin berubah. Coba lagi nanti.');
      url = next;
    }
    if (!response?.ok) throw new ApiError(response?.status === 404 ? 'Judul atau episode tidak ditemukan.' : 'Anichin sedang tidak dapat dihubungi.', response?.status === 404 ? 404 : 502);
    if (Number(response.headers.get('content-length') || 0) > 2_000_000) throw new ApiError('Respons sumber terlalu besar.');
    const html = await response.text();
    if (html.length > 2_000_000 || /<title>\s*(Just a moment|Attention Required)/i.test(html)) throw new ApiError('Anichin sedang membatasi akses. Coba lagi nanti.');
    return html;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(controller.signal.aborted ? 'Anichin terlalu lama merespons. Coba lagi.' : 'Koneksi ke Anichin gagal. Coba lagi.', controller.signal.aborted ? 504 : 502);
  } finally { clearTimeout(timer); }
}
export async function getAnichin(endpoint, segments = [], params = new URLSearchParams(), fetcher = fetch) {
  const page = pageNumber(params.get('page') ?? '1'), slug = segments[0];
  let path, parse;
  if (segments.length > 1) throw new ApiError('Endpoint tidak ditemukan.', 404);
  switch (endpoint) {
    case 'home': case 'schedule':
      if (slug) throw new ApiError('Endpoint tidak ditemukan.', 404);
      path = page === 1 ? '/' : `/page/${page}/`;
      parse = endpoint === 'schedule' ? parseSchedule : html => parseHome(html, page); break;
    case 'anime': case 'search': {
      if (slug) throw new ApiError('Endpoint tidak ditemukan.', 404);
      const query = clean(params.get('q') ?? params.get('query'));
      if (endpoint === 'search' && (!query || query.length > 100)) throw new ApiError('Isi pencarian 1–100 karakter.', 400);
      const p = new URLSearchParams({ page: String(page) });
      if (endpoint === 'search') { p.delete('page'); p.set('s', query); p.set('paged', String(page)); }
      const genre = params.get('genre'); if (genre) p.append('genre[]', validSlug(genre));
      path = (endpoint === 'search' ? '/?' : '/anime/?') + p;
      parse = html => parseCatalog(html, { page, query }); break;
    }
    case 'info': case 'episode': case 'video-source':
      validSlug(slug); path = `/${slug}/`; parse = endpoint === 'info' ? html => parseInfo(html, slug) : html => parseEpisode(html, slug); break;
    case 'genres':
      if (slug) throw new ApiError('Endpoint tidak ditemukan.', 404);
      path = '/anime/'; parse = html => { const $ = load(html); return { results: $('input[name="genre[]"]').toArray().map(el => ({ slug: $(el).attr('value'), name: clean($(el).parent().text()) })).filter(x => SLUG.test(x.slug ?? '') && x.name), source: SOURCE }; }; break;
    default: throw new ApiError('Endpoint tidak ditemukan.', 404);
  }
  const key = path + '|' + endpoint, entry = cache.get(key);
  if (entry && entry.until > Date.now()) return entry.value;
  let html;
  try { html = await upstream(path, fetcher); }
  catch (error) { if (endpoint === 'info' && error.status === 404) html = await upstream(`/anime/${slug}/`, fetcher); else throw error; }
  const value = parse(html); value.fetched_at = new Date().toISOString();
  if (cache.size >= 100) cache.delete(cache.keys().next().value);
  cache.set(key, { value, until: Date.now() + TTL }); return value;
}
export async function handleAnichinRequest(request) {
  try {
    const url = new URL(request.url), pieces = url.pathname.replace(/^\/api\/anichin\//, '').split('/').filter(Boolean);
    const data = await getAnichin(pieces[0], pieces.slice(1), url.searchParams);
    return Response.json(data, { headers: { 'Cache-Control': 'private, max-age=60', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) {
    return Response.json({ error: error instanceof ApiError ? error.message : 'Data belum dapat dimuat. Coba lagi.', source: SOURCE }, { status: error instanceof ApiError ? error.status : 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
