const svc = require('../services/partida_log.service')

// GET /api/partida/:id/log → historial de actividad, ya resuelto según el rol
const getLog = async (req, res, next) => {
  try {
    res.json(await svc.listar(req.params.id, req.user.role === 'master'))
  } catch (e) { next(e) }
}

// POST /api/partida/:id/log  { texto, texto_master?, role }
const agregarLog = async (req, res, next) => {
  try {
    const r = await svc.agregar(req.params.id, req.body || {})
    if (r.error) return res.status(400).json({ error: 'Falta texto' })
    res.status(201).json(r)
  } catch (e) { next(e) }
}

module.exports = { getLog, agregarLog }
