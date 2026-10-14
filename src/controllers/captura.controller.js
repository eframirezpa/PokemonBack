const svc = require('../services/captura.service')

// GET /api/partida/:id/captura-auto → { activa } (lo lee toda la mesa)
const getCapturaAuto = async (req, res, next) => {
  try {
    const r = await svc.findCapturaAuto(req.params.id)
    if (r.error) return res.status(404).json({ error: 'Partida no encontrada' })
    res.json({ activa: r.activa })
  } catch (e) { next(e) }
}

// PATCH /api/partida/:id/captura-auto  { activa }  (solo el máster dueño)
const setCapturaAuto = async (req, res, next) => {
  try {
    const r = await svc.setCapturaAuto(req.params.id, req.user.user_id, !!req.body?.activa)
    if (r.error) return res.status(404).json({ error: 'Partida no encontrada' })
    res.json({ activa: r.activa })
  } catch (e) { next(e) }
}

const ERRORES = {
  notfound:   [404, 'Partida no encontrada'],
  manual:     [409, 'La captura automática está apagada: decide el máster'],
  personaje:  [403, 'Ese personaje no es tuyo o no está en esta partida'],
  nocampo:    [409, 'Ese Pokémon ya no está en el campo'],
  enbola:     [409, 'Ese Pokémon está dentro de una pokébola'],
  debilitado: [409, 'No se puede atrapar un Pokémon debilitado'],
  sinbola:    [409, 'No te quedan pokébolas de ese tipo'],
  tirada:     [400, 'El d20 tiene que estar entre 1 y 20'],
}

// POST /api/partida/:id/captura  (cualquier entrenador de la mesa, sobre su personaje)
const capturar = async (req, res, next) => {
  try {
    const r = await svc.capturar(req.params.id, req.user.user_id, req.body || {})
    if (r.error) {
      const [status, error] = ERRORES[r.error] || [400, 'No se pudo lanzar la pokébola']
      return res.status(status).json({ error, codigo: r.error })
    }
    res.json(r)
  } catch (e) { next(e) }
}

module.exports = { getCapturaAuto, setCapturaAuto, capturar }
