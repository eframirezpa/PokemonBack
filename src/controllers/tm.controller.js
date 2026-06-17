const svc = require('../services/tm.service')

const getAll = async (req, res, next) => {
  try {
    const { limit = 20, offset = 0, search = '' } = req.query
    res.json(await svc.findAll({ limit: Number(limit), offset: Number(offset), search }))
  } catch (e) { next(e) }
}

const getById = async (req, res, next) => {
  try {
    const data = await svc.findById(req.params.id)
    if (!data) return res.status(404).json({ error: 'TM no encontrado' })
    res.json(data)
  } catch (e) { next(e) }
}

module.exports = { getAll, getById }
