const svc = require('../services/pokemon.service')

const getAll = async (req, res, next) => {
  try {
    const { limit = 20, offset = 0, search = '', type = '' } = req.query
    const result = await svc.findAll({ limit: Number(limit), offset: Number(offset), search, type })
    res.json(result)
  } catch (e) { next(e) }
}

const getById = async (req, res, next) => {
  try {
    const data = await svc.findById(req.params.id)
    if (!data) return res.status(404).json({ error: 'Pokemon no encontrado' })
    res.json(data)
  } catch (e) { next(e) }
}

module.exports = { getAll, getById }
