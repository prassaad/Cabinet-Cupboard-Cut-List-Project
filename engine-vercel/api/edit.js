// POST /edit  (mapped from /edit via vercel.json rewrite)
// Body: { design, op, args?, scope? }  ->  { design, model }
const { getEngine } = require('../lib/engine');
const { requireKey, readJson } = require('../lib/http');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: { code: 'method_not_allowed' } });
  if (!requireKey(req, res)) return;

  const p = await readJson(req);
  if (!p) return res.status(400).json({ error: { code: 'bad_json', message: 'invalid JSON body' } });
  if (!p.design || typeof p.design !== 'object' || !p.op) {
    return res.status(422).json({ error: { code: 'unprocessable', message: 'design and op are required' } });
  }

  try {
    const scope = p.scope === 'job' ? 'job' : 'module';
    const result = getEngine().edit(p.design, String(p.op), p.args || {}, scope);
    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({ error: { code: 'engine_error', message: String(e && e.message || e) } });
  }
};
