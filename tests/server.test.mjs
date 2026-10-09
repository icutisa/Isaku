import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createAppServer } from '../server.mjs';

async function withServer(run, options) {
  const server = createAppServer(options);
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('standalone server serves the complete shell and browser modules with correct MIME types', async () => {
  await withServer(async origin => {
    const page = await fetch(origin), html = await page.text();
    assert.equal(page.status, 200); assert.match(html, /lang="id"/);
    assert.match(html, /name="viewport"/); assert.match(html, /id="main"/);
    assert.match(html, /src="\/live-app\.mjs"/); assert.match(html, /href="\/styles\.css"/);
    const script = await fetch(origin + '/live-app.mjs');
    assert.match(script.headers.get('content-type'), /javascript/);
    assert.match(await script.text(), /history-groups/);
    const css = await fetch(origin + '/styles.css');
    assert.match(css.headers.get('content-type'), /text\/css/);
    assert.equal((await fetch(origin + '/assets/sky.webp')).status, 200);
  });
});
test('server connects same-origin API routes and preserves errors and caching headers', async () => {
  await withServer(async origin => {
    const response = await fetch(origin + '/api/anichin/search?q=sword&page=2');
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, max-age=60');
    assert.deepEqual(await response.json(), { query: 'sword', page: '2' });
  }, { apiHandler: async request => {
    const url = new URL(request.url);
    assert.equal(url.pathname, '/api/anichin/search');
    return Response.json({ query: url.searchParams.get('q'), page: url.searchParams.get('page') }, { headers: { 'Cache-Control': 'private, max-age=60' } });
  } });
  await withServer(async origin => {
    const response = await fetch(origin + '/api/anichin/unknown');
    assert.equal(response.status, 404); assert.match((await response.json()).error, /Endpoint/);
  });
});
test('server blocks traversal, hidden files, missing files, malformed paths, and unsupported methods', async () => {
  await withServer(async origin => {
    for (const path of ['/%2e%2e%2fpackage.json', '/.env', '/.git/config', '/missing']) {
      assert.equal((await fetch(origin + path)).status, 404);
    }
    assert.equal((await fetch(origin + '/%zz')).status, 400);
    const post = await fetch(origin, { method: 'POST' });
    assert.equal(post.status, 405); assert.equal(post.headers.get('allow'), 'GET, HEAD');
  });
});
test('HEAD, conditional asset requests, and health checks work without sending unwanted bodies', async () => {
  await withServer(async origin => {
    const get = await fetch(origin + '/styles.css');
    const head = await fetch(origin + '/styles.css', { method: 'HEAD' });
    assert.equal(head.status, 200); assert.equal(await head.text(), '');
    assert.ok(Number(head.headers.get('content-length')) > 0);
    const cached = await fetch(origin + '/styles.css', { headers: { 'If-None-Match': get.headers.get('etag') } });
    assert.equal(cached.status, 304); assert.equal(await cached.text(), '');
    assert.deepEqual(await (await fetch(origin + '/healthz')).json(), { ok: true, app: 'CutsaPlay' });
  });
});
