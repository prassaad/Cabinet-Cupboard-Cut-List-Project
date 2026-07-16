// POST /compute  (mapped from /compute via vercel.json rewrite)
// Body: { design, scope?, currency?, prices?, render?, room? }
const { getEngine } = require('../lib/engine');
const { requireKey, readJson } = require('../lib/http');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: { code: 'method_not_allowed' } });
  if (!requireKey(req, res)) return;

  const p = await readJson(req);
  if (!p) return res.status(400).json({ error: { code: 'bad_json', message: 'invalid JSON body' } });
  if (!p.design || typeof p.design !== 'object') {
    return res.status(422).json({ error: { code: 'unprocessable', message: 'design is required' } });
  }

  try {
    const scope = p.scope === 'job' ? 'job' : 'module';
    const result = getEngine().compute(p.design, {
      scope,
      currency: p.currency,
      prices: p.prices,
      render: !!p.render,
      room: !!p.room,
    });
    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({ error: { code: 'engine_error', message: String(e && e.message || e) } });
  }
};
