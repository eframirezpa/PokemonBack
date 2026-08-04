const svc = require('../services/personaje_pokemon_improvement.service')

// GET /api/personaje/:id/pending-improvements
const listPending = async (req, res) => {
  try {
    const data = await svc.listPending(Number(req.params.id))
    res.json(data)
  } catch (e) { console.error(e); res.status(500).json({ error: 'server' }) }
}

// POST /api/personaje/:id/pokemon/:idpp/improvement/moves  { move_ids: [], hp_roll }
const confirmMoves = async (req, res) => {
  try {
    const r = await svc.confirmMoves(Number(req.params.id), Number(req.params.idpp), req.body.move_ids, req.body.hp_roll)
    if (r.error === 'notfound') return res.status(404).json({ error: r.error })
    if (r.error === 'hproll') return res.status(400).json({ error: r.error, max: r.max })
    if (r.error === 'toomany' || r.error === 'invalidmove') return res.status(400).json({ error: r.error })
    res.json(r)
  } catch (e) { console.error(e); res.status(500).json({ error: 'server' }) }
}

// POST /api/personaje/:id/pokemon/:idpp/improvement/asi  { stats: {}, feat: {} | null, hp_roll }
const confirmAsi = async (req, res) => {
  try {
    const r = await svc.confirmAsi(Number(req.params.id), Number(req.params.idpp), req.body.stats, req.body.feat, req.body.hp_roll)
    if (r.error === 'notfound' || r.error === 'featnotfound') return res.status(404).json({ error: r.error })
    if (r.error === 'hproll') return res.status(400).json({ error: r.error, max: r.max })
    if (r.error === 'duplicate') return res.status(409).json({ error: r.error })
    if (r.error === 'points') return res.status(400).json({ error: r.error, points: r.points })
    res.json(r)
  } catch (e) { console.error(e); res.status(500).json({ error: 'server' }) }
}

module.exports = { listPending, confirmMoves, confirmAsi }
