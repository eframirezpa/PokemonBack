const svc = require('../services/origins.service')

const getAll = async (req, res, next) => {
  try {
    const { limit = 100, offset = 0, search = '' } = req.query
    res.json(await svc.findAll({ limit: Number(limit), offset: Number(offset), search }))
  } catch (e) { next(e) }
}

const getById = async (req, res, next) => {
  try {
    const data = await svc.findById(req.params.id)
    if (!data) return res.status(404).json({ error: 'Origen no encontrado' })
    res.json(data)
  } catch (e) { next(e) }
}

const getForCharacterCreation = async (_req, res, next) => {
  try {
    res.json(await svc.findForCharacterCreation())
  } catch (e) { next(e) }
}

module.exports = { getAll, getById, getForCharacterCreation }
