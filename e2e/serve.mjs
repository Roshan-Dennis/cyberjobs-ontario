/**
 * Serve `out/` the way GitHub Pages does: under the repository base path,
 * `/foo/` -> `/foo/index.html`, and the export's 404.html for anything missing.
 *
 *   node e2e/serve.mjs            # http://localhost:4173/cyberjobs-ontario/
 */
import { createServer } from 'node:http';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('out');
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '/cyberjobs-ontario';
const PORT = Number(process.env.PORT ?? 4173);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain',
  '.xml': 'application/xml', '.mjs': 'text/javascript', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

async function resolve(urlPath) {
  if (!urlPath.startsWith(BASE)) return null;
  let rel = decodeURIComponent(urlPath.slice(BASE.length)) || '/';
  if (rel.includes('..')) return null;
  const candidates = rel.endsWith('/') ? [rel + 'index.html'] : [rel, rel + '.html', rel + '/index.html'];
  for (const c of candidates) {
    const file = path.join(ROOT, c);
    try {
      if ((await fs.stat(file)).isFile()) return file;
    } catch { /* try next */ }
  }
  return null;
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === BASE) {
    res.writeHead(301, { Location: BASE + '/' + url.search });
    return res.end();
  }
  const file = await resolve(url.pathname);
  const target = file ?? path.join(ROOT, '404.html');
  res.writeHead(file ? 200 : 404, { 'Content-Type': TYPES[path.extname(target)] ?? 'application/octet-stream' });
  createReadStream(target).pipe(res);
}).listen(PORT, () => console.log(`serving ${ROOT} at http://localhost:${PORT}${BASE}/`));
