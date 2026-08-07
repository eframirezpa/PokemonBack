const svc = require('../services/personaje_improvement.service')

// GET /api/personaje/:id/improvements → niveles pendientes, del más bajo al más alto
const getPending = async (req, res, next) => {
  try { res.json(await svc.listPending(req.params.id)) } catch (e) { next(e) }
}

// GET /api/personaje/:id/improvements/specializations → las que aún no tiene
const getSpecs = async (req, res, next) => {
  try { res.json(await svc.specsDisponibles(req.params.id)) } catch (e) { next(e) }
}

// POST /api/personaje/:id/improvements/:pendingId/confirm
const confirm = async (req, res, next) => {
  try {
    const r = await svc.confirm(req.params.id, req.params.pendingId, req.body || {})
    if (r.error === 'notfound')       return res.status(404).json({ error: 'Mejora no encontrada o ya aplicada' })
    if (r.error === 'orden')          return res.status(409).json({ error: `Primero confirma el nivel ${r.lvl}`, lvl: r.lvl })
    if (r.error === 'hproll')         return res.status(400).json({ error: `La tirada debe estar entre 1 y ${r.max}`, max: r.max })
    if (r.error === 'asi')            return res.status(400).json({ error: `Debes repartir exactamente ${r.puntos} puntos` })
    if (r.error === 'specialization') return res.status(400).json({ error: 'Elige una especialización que no tengas' })
    if (r.error === 'saving')         return res.status(400).json({ error: 'Elige una salvación en la que no seas proficiente' })
    if (r.error === 'path')           return res.status(400).json({ error: 'Elige una ruta válida' })
    if (r.error === 'sinpath')        return res.status(409).json({ error: 'Primero debes elegir tu ruta (nivel 2)' })
    if (r.error === 'pathskills')     return res.status(400).json({ error: `Debes elegir exactamente ${r.cuantas} habilidad(es) para el rasgo de ruta` })
    res.json(r)
  } catch (e) { next(e) }
}

module.exports = { getPending, getSpecs, confirm }
