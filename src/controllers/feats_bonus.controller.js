const svc = require('../services/feats_bonus.service')

// GET /api/feats-bonus  (?id_feat=123 para filtrar por feat)
const getAll = async (req, res, next) => {
  try {
    const { id_feat } = req.query
    res.json(await svc.findAll({ id_feat: id_feat ? Number(id_feat) : undefined }))
  } catch (e) { next(e) }
}

const getById = async (req, res, next) => {
  try {
    const data = await svc.findById(req.params.id)
    if (!data) return res.status(404).json({ error: 'Bono no encontrado' })
    res.json(data)
  } catch (e) { next(e) }
}

const getByFeat = async (req, res, next) => {
  try {
    res.json(await svc.findByFeat(req.params.featId))
  } catch (e) { next(e) }
}

const create = async (req, res, next) => {
  try {
    if (!req.body.id_feat) return res.status(400).json({ error: 'id_feat requerido' })
    res.status(201).json(await svc.create(req.body))
  } catch (e) { next(e) }
}

const update = async (req, res, next) => {
  try {
    const data = await svc.update(req.params.id, req.body)
    if (!data) return res.status(404).json({ error: 'Bono no encontrado' })
    res.json(data)
  } catch (e) { next(e) }
}

const remove = async (req, res, next) => {
  try {
    const ok = await svc.remove(req.params.id)
    if (!ok) return res.status(404).json({ error: 'Bono no encontrado' })
    res.status(204).end()
  } catch (e) { next(e) }
}

module.exports = { getAll, getById, getByFeat, create, update, remove }
