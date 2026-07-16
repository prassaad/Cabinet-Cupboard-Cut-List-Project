// GET /  (mapped from / via vercel.json rewrite) — friendly root instead of a
// raw 404. Purely cosmetic; the real work is at /compute and /edit.
module.exports = (req, res) => {
  return res.status(200).json({
    service: 'wallview-engine',
    status: 'ok',
    routes: { health: 'GET /health', compute: 'POST /compute', edit: 'POST /edit' },
  });
};
