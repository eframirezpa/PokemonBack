const svc = require('../services/pokemon_experience_levels.service')

const getAll = async (_req, res, next) => {
  try {
    res.json(await svc.findAll())
  } catch (e) { next(e) }
}

const getById = async (req, res, next) => {
  try {
    const data = await svc.findById(req.params.id)
    if (!data) return res.status(404).json({ error: 'Nivel de experiencia no encontrado' })
    res.json(data)
  } catch (e) { next(e) }
}

const getByLevel = async (req, res, next) => {
  try {
    const data = await svc.findByLevel(req.params.level)
    if (!data) return res.status(404).json({ error: 'Nivel de experiencia no encontrado' })
    res.json(data)
  } catch (e) { next(e) }
}

module.exports = { getAll, getById, getByLevel }
