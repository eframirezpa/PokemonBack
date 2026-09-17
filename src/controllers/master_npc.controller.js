const svc = require('../services/master_npc.service')

// GET /api/master/npc → los NPC del máster
const getAll = async (req, res, next) => {
  try {
    res.json(await svc.findByMaster(req.user.user_id))
  } catch (e) { next(e) }
}

// GET /api/master/npc/sugerencia?level=5 → vida tirada, apodo y cara al azar
const getSugerencia = async (req, res, next) => {
  try {
    res.json(await svc.sugerencia(req.query.level))
  } catch (e) { next(e) }
}

// GET /api/master/npc/:idnpc
const getById = async (req, res, next) => {
  try {
    const npc = await svc.findById(req.params.idnpc, req.user.user_id)
    if (!npc) return res.status(404).json({ error: 'NPC no encontrado' })
    res.json(npc)
  } catch (e) { next(e) }
}

// POST /api/master/npc  { apodo, level, hp, avatar }
const create = async (req, res, next) => {
  try {
    const { apodo, level, hp, avatar } = req.body
    const nivel = Number(level)
    if (!Number.isFinite(nivel) || nivel < svc.NIVEL_MIN || nivel > svc.NIVEL_MAX) {
      return res.status(400).json({ error: `El nivel debe estar entre ${svc.NIVEL_MIN} y ${svc.NIVEL_MAX}` })
    }
    if (!String(apodo || '').trim()) return res.status(400).json({ error: 'El apodo es obligatorio' })
    res.status(201).json(await svc.create(req.user.user_id, { apodo, level: nivel, hp, avatar }))
  } catch (e) { next(e) }
}

// PATCH /api/master/npc/:idnpc  { apodo, hp, avatar }
const update = async (req, res, next) => {
  try {
    const { apodo, hp, avatar } = req.body
    if (!String(apodo || '').trim()) return res.status(400).json({ error: 'El apodo es obligatorio' })
    const npc = await svc.update(req.params.idnpc, req.user.user_id, { apodo, hp, avatar })
    if (!npc) return res.status(404).json({ error: 'NPC no encontrado' })
    res.json(npc)
  } catch (e) { next(e) }
}

// PATCH /api/master/npc/:idnpc/combate  { current_hp } → la vida que le queda
const updateCombate = async (req, res, next) => {
  try {
    const npc = await svc.setCombate(req.params.idnpc, req.body.current_hp)
    if (!npc) return res.status(404).json({ error: 'NPC no encontrado' })
    res.json(npc)
  } catch (e) { next(e) }
}

// DELETE /api/master/npc/:idnpc
const remove = async (req, res, next) => {
  try {
    const ok = await svc.remove(req.params.idnpc, req.user.user_id)
    if (!ok) return res.status(404).json({ error: 'NPC no encontrado' })
    res.json({ ok: true })
  } catch (e) { next(e) }
}

module.exports = { getAll, getSugerencia, getById, create, update, updateCombate, remove }
