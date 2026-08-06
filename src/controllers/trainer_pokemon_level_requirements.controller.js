const svc = require('../services/trainer_pokemon_level_requirements.service')

const getAll = async (_req, res, next) => {
  try { res.json(await svc.findAll()) } catch (e) { next(e) }
}

const getById = async (req, res, next) => {
  try {
    const data = await svc.findById(req.params.id)
    if (!data) return res.status(404).json({ error: 'Requisito no encontrado' })
    res.json(data)
  } catch (e) { next(e) }
}

const getByLevel = async (req, res, next) => {
  try {
    const data = await svc.findByLevel(req.params.level)
    if (!data) return res.status(404).json({ error: 'Requisito no encontrado' })
    res.json(data)
  } catch (e) { next(e) }
}

// GET /for-total/:total → qué nivel de entrenador da ese total de niveles
const getForTotal = async (req, res, next) => {
  try {
    const total = Number(req.params.total)
    if (!Number.isFinite(total) || total < 0) {
      return res.status(400).json({ error: 'total inválido' })
    }
    res.json({ total, trainer_level: await svc.levelForTotal(total) })
  } catch (e) { next(e) }
}

// GET /estado/:id_personaje → cuántos niveles suma y qué nivel le toca
const getEstado = async (req, res, next) => {
  try {
    const data = await svc.trainerLevelState(req.params.id)
    if (!data) return res.status(404).json({ error: 'Personaje no encontrado' })
    res.json(data)
  } catch (e) { next(e) }
}

module.exports = { getAll, getById, getByLevel, getForTotal, getEstado }
