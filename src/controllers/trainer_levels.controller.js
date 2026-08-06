const svc = require('../services/trainer_levels.service')

const getAll = async (_req, res, next) => {
  try { res.json(await svc.findAll()) } catch (e) { next(e) }
}

const getById = async (req, res, next) => {
  try {
    const data = await svc.findById(req.params.id)
    if (!data) return res.status(404).json({ error: 'Nivel de entrenador no encontrado' })
    res.json(data)
  } catch (e) { next(e) }
}

const getByLevel = async (req, res, next) => {
  try {
    const data = await svc.findByLevel(req.params.level)
    if (!data) return res.status(404).json({ error: 'Nivel de entrenador no encontrado' })
    res.json(data)
  } catch (e) { next(e) }
}

// GET /range?desde=1&hasta=4 → lo que se gana al subir de `desde` a `hasta`
const getRange = async (req, res, next) => {
  try { res.json(await svc.findRange(req.query.desde, req.query.hasta)) } catch (e) { next(e) }
}

module.exports = { getAll, getById, getByLevel, getRange }
