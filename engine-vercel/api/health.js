// GET /health  (mapped from /health via vercel.json rewrite)
// Confirms the function boots AND the engine app.js loads.
const { getEngine } = require('../lib/engine');

module.exports = (req, res) => {
  try {
    getEngine();   // throws if app.js is missing/unparseable
    return res.status(200).json({ status: 'ok', service: 'wallview-engine' });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: String(e && e.message || e) });
  }
};
