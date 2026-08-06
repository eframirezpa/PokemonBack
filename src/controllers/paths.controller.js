const svc = require('../services/paths.service')

const getAll = async (_req, res, next) => {
  try { res.json(await svc.findAll()) } catch (e) { next(e) }
}

const getById = async (req, res, next) => {
  try {
    const data = await svc.findById(req.params.id)
    if (!data) return res.status(404).json({ error: 'Path no encontrado' })
    res.json(data)
  } catch (e) { next(e) }
}

const getByNameId = async (req, res, next) => {
  try {
    const data = await svc.findByNameId(req.params.nameId)
    if (!data) return res.status(404).json({ error: 'Path no encontrado' })
    res.json(data)
  } catch (e) { next(e) }
}

// GET /:id/bonus/:level → bonos que el path ya otorgó a ese nivel
const getBonusUpToLevel = async (req, res, next) => {
  try { res.json(await svc.bonusUpToLevel(req.params.id, req.params.level)) } catch (e) { next(e) }
}

module.exports = { getAll, getById, getByNameId, getBonusUpToLevel }
