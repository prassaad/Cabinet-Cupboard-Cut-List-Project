// Loads the real designer engine (app.js) once per warm serverless instance and
// caches it. Vercel keeps instances warm between requests, so the ~2900-line
// app.js is parsed on cold start only, then reused.
const fs = require('fs');
const path = require('path');
const { loadEngine } = require('./load');

let engine = null;

// app.js is bundled next to this deployment (see vercel.json `includeFiles`).
// Try the likely locations so it resolves regardless of how Vercel lays out
// the function bundle.
function findAppSource() {
  const candidates = [
    process.env.ENGINE_APP_PATH,
    path.join(process.cwd(), 'app.js'),
    path.join(__dirname, '..', 'app.js'),
    path.join(__dirname, 'app.js'),
  ].filter(Boolean);
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8'); } catch (e) { /* keep trying */ }
  }
  throw new Error('engine app.js not found. Looked in: ' + candidates.join(', '));
}

function getEngine() {
  if (!engine) engine = loadEngine(findAppSource());
  return engine;
}

module.exports = { getEngine };
