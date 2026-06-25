const svc = require('../services/skills.service')

const getAll = async (_req, res, next) => {
  try { res.json(await svc.findAll()) } catch (e) { next(e) }
}

const getById = async (req, res, next) => {
  try {
    const data = await svc.findById(req.params.id)
    if (!data) return res.status(404).json({ error: 'Skill no encontrada' })
    res.json(data)
  } catch (e) { next(e) }
}

module.exports = { getAll, getById }
