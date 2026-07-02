/* Cabinet Cut List — tiny static server + OpenAI proxy. Zero dependencies (Node 18+).
   - Serves the /prototype app at http://localhost:3000
   - POST /api/chat  ->  forwards to api.openai.com with your secret key attached
   Run:  OPENAI_API_KEY=sk-...  node server/server.js   (or put the key in server/.env) */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

// --- minimal .env loader (so you can drop the key in server/.env) ---
(() => {
  try {
    const env = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    for (const line of env.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  } catch { /* no .env, that's fine */ }
})();

const PORT = process.env.PORT || 3000;
const KEY = process.env.OPENAI_API_KEY;
const ROOT = path.join(__dirname, '..', 'prototype');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/chat') return proxyLLM(req, res);

  // static files from /prototype
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, {
      'content-type': MIME[path.extname(file)] || 'application/octet-stream',
      // Dev server: never let the browser cache the app, so code edits always show on reload.
      'cache-control': 'no-store, no-cache, must-revalidate',
    });
    res.end(data);
  });
});

function proxyLLM(req, res) {
  if (!KEY) { res.writeHead(500, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: { message: 'OPENAI_API_KEY is not set on the server.' } })); }
  let body = '';
  req.on('data', (c) => { body += c; if (body.length > 1e7) req.destroy(); });
  req.on('end', async () => {
    try {
      const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': `Bearer ${KEY}` },
        body,
      });
      const text = await upstream.text();
      res.writeHead(upstream.status, { 'content-type': 'application/json' });
      res.end(text);
    } catch (e) {
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Upstream request failed: ' + String(e) }));
    }
  });
}

server.listen(PORT, () => {
  console.log(`\n  Cabinet Cut List + Design Copilot`);
  console.log(`  → http://localhost:${PORT}`);
  console.log(`  OpenAI key: ${KEY ? 'loaded ✓' : 'MISSING ✗  (set OPENAI_API_KEY)'}\n`);
});
