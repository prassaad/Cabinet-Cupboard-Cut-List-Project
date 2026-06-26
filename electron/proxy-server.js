'use strict';
/* In-process static server + OpenAI proxy for the Electron desktop build.
   - Serves the untouched prototype/ folder over 127.0.0.1 (so the app's fetch('/api/chat') keeps working as-is).
   - Proxies POST /api/chat to OpenAI using the user's locally-stored key (Bring-Your-Own-Key).
   Pure Node built-ins (+ global fetch) so it can be unit/smoke-tested without Electron. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

function proxyChat(req, res, getKey) {
  const key = (getKey && getKey()) || '';
  if (!key) {
    res.writeHead(400, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ error: { message: 'No OpenAI key set. Open the menu: AI → Set API Key… (the rest of the app works without it).' } }));
  }
  let body = '';
  req.on('data', (c) => { body += c; if (body.length > 1e7) req.destroy(); });
  req.on('end', async () => {
    try {
      const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': `Bearer ${key}` },
        body,
      });
      const text = await upstream.text();
      res.writeHead(upstream.status, { 'content-type': 'application/json' });
      res.end(text);
    } catch (e) {
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Upstream request failed: ' + String(e) } }));
    }
  });
}

function createServer({ rootDir, getKey }) {
  return http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api/chat') return proxyChat(req, res, getKey);
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const file = path.normalize(path.join(rootDir, p));
    if (!file.startsWith(path.normalize(rootDir))) { res.writeHead(403); return res.end('Forbidden'); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
}

// Bind to an ephemeral port on localhost only. Returns { server, port }.
function start({ rootDir, getKey }) {
  return new Promise((resolve, reject) => {
    const server = createServer({ rootDir, getKey });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

module.exports = { start, createServer };
