import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { handleAnichinRequest } from './lib/anichin.mjs';

const publicRoot = fileURLToPath(new URL('./public/', import.meta.url));
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

function json(response, status, data, method = 'GET', extra = {}) {
  const body = Buffer.from(JSON.stringify(data));
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
    ...extra,
  });
  response.end(method === 'HEAD' ? undefined : body);
}

export function createAppServer({ apiHandler = handleAnichinRequest } = {}) {
  return createServer(async (request, response) => {
    const method = request.method ?? 'GET';
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    try {
      if (!['GET', 'HEAD'].includes(method)) {
        json(response, 405, { error: 'Metode tidak didukung.' }, method, { Allow: 'GET, HEAD' });
        return;
      }
      let url, pathname;
      try {
        url = new URL(request.url ?? '/', 'http://localhost');
        pathname = decodeURIComponent(url.pathname);
        if (pathname.includes('\0') || pathname.includes('\\')) throw new Error('Invalid path');
      } catch {
        json(response, 400, { error: 'Alamat tidak valid.' }, method);
        return;
      }
      if (pathname === '/healthz') {
        json(response, 200, { ok: true, app: 'CutsaPlay' }, method);
        return;
      }
      if (pathname.startsWith('/api/anichin/')) {
        const result = await apiHandler(new Request(url.href));
        const body = Buffer.from(await result.arrayBuffer());
        response.writeHead(result.status, { ...Object.fromEntries(result.headers), 'Content-Length': body.length });
        response.end(method === 'HEAD' ? undefined : body);
        return;
      }
      const target = resolve(publicRoot, '.' + (pathname === '/' ? '/index.html' : pathname));
      const child = relative(publicRoot, target);
      if (!child || child.startsWith('..' + sep) || child === '..' || child.split(sep).some(part => part.startsWith('.'))) {
        json(response, 404, { error: 'File tidak ditemukan.' }, method);
        return;
      }
      let info;
      try { info = await stat(target); }
      catch (error) {
        if (['ENOENT', 'ENOTDIR'].includes(error.code)) {
          json(response, 404, { error: 'File tidak ditemukan.' }, method); return;
        }
        throw error;
      }
      if (!info.isFile()) {
        json(response, 404, { error: 'File tidak ditemukan.' }, method); return;
      }
      const etag = `W/"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
      const headers = {
        'Content-Type': contentTypes[extname(target).toLowerCase()] ?? 'application/octet-stream',
        'Cache-Control': 'no-cache',
        ETag: etag,
      };
      if (request.headers['if-none-match'] === etag) {
        response.writeHead(304, headers); response.end(); return;
      }
      response.writeHead(200, { ...headers, 'Content-Length': info.size });
      response.end(method === 'HEAD' ? undefined : await readFile(target));
    } catch (error) {
      console.error('CutsaPlay request failed:', error.message);
      if (!response.headersSent) json(response, 500, { error: 'Server belum dapat memproses permintaan.' }, method);
      else response.destroy();
    }
  });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('PORT harus berupa angka antara 1 dan 65535.'); process.exit(1);
  }
  const host = process.env.BIND_HOST ?? '0.0.0.0';
  const server = createAppServer();
  server.on('error', error => { console.error('CutsaPlay gagal berjalan:', error.message); process.exitCode = 1; });
  server.listen(port, host, () => console.log(`CutsaPlay berjalan pada port ${port}.`));
  const shutdown = () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
}
