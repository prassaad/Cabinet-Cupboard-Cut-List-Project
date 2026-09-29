// Local dev runner for THE engine.  node engine-vercel/dev-server.js
//
// This is NOT a second copy of the engine — it requires the very same api/
// handlers Vercel invokes, so there is nothing here to drift out of sync. It
// exists so you can exercise engine changes locally before redeploying: point
// wallview-api/.env at it with
//     ENGINE_URL=http://127.0.0.1:4001
// and set ENGINE_KEY empty (or export the same key here) while developing.
'use strict';
const http = require('http');
const compute = require('./api/compute.js');
const edit = require('./api/edit.js');
const health = require('./api/health.js');

const PORT = +(process.env.PORT || 4001);
const ROUTES = { '/compute': compute, '/edit': edit, '/health': health, '/': health };

http.createServer(async (req, res) => {
  // The handlers are written against Vercel's res helpers; add them here.
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(obj));
    return res;
  };
  const path = (req.url || '/').split('?')[0];
  const handler = ROUTES[path];
  if (!handler) return res.status(404).json({ error: { code: 'not_found', message: path } });
  const t0 = Date.now();
  try {
    await handler(req, res);
  } catch (e) {
    res.status(500).json({ error: { code: 'engine_error', message: String((e && e.message) || e) } });
  }
  console.log(`${req.method} ${path} ${res.statusCode} ${Date.now() - t0}ms`);
}).listen(PORT, '127.0.0.1', () => {
  console.log(`engine (dev) → http://127.0.0.1:${PORT}   [/compute /edit /health]`);
  if (!process.env.ENGINE_KEY) console.log('ENGINE_KEY not set — the key check is skipped locally.');
});
