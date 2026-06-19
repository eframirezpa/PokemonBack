const svc = require('../services/feats.service')

const getAll = async (req, res, next) => {
  try {
    const { limit = 100, offset = 0, search = '', type = '' } = req.query
    res.json(await svc.findAll({ limit: Number(limit), offset: Number(offset), search, type }))
  } catch (e) { next(e) }
}

const getById = async (req, res, next) => {
  try {
    const data = await svc.findById(req.params.id)
    if (!data) return res.status(404).json({ error: 'Feat no encontrado' })
    res.json(data)
  } catch (e) { next(e) }
}

module.exports = { getAll, getById }
