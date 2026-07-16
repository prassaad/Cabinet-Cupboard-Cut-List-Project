// Small shared helpers for the serverless handlers: shared-secret gate + body
// reader that works whether or not Vercel pre-parsed the JSON body.
function requireKey(req, res) {
  const expected = process.env.ENGINE_KEY;
  if (expected && req.headers['x-engine-key'] !== expected) {
    res.status(401).json({ error: { code: 'unauthorized', message: 'bad or missing X-Engine-Key' } });
    return false;
  }
  return true;
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;    // Vercel parsed it
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try { return raw ? JSON.parse(raw) : {}; } catch (e) { return null; }
}

module.exports = { requireKey, readJson };
