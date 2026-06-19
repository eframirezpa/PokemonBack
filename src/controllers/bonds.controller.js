const svc = require('../services/bonds.service')

const getAll = async (req, res, next) => {
  try {
    const { limit = 100, offset = 0 } = req.query
    res.json(await svc.findAll({ limit: Number(limit), offset: Number(offset) }))
  } catch (e) { next(e) }
}

const getById = async (req, res, next) => {
  try {
    const data = await svc.findById(req.params.id)
    if (!data) return res.status(404).json({ error: 'Bond no encontrado' })
    res.json(data)
  } catch (e) { next(e) }
}

module.exports = { getAll, getById }
