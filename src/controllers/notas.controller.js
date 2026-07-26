const svc = require('../services/notas.service')

// GET /api/notas?id_personaje=123
const getAll = async (req, res, next) => {
  try {
    const id_personaje = Number(req.query.id_personaje)
    if (!id_personaje) return res.status(400).json({ error: 'id_personaje requerido' })
    res.json(await svc.findByPersonaje(id_personaje))
  } catch (e) { next(e) }
}

const getById = async (req, res, next) => {
  try {
    const data = await svc.findById(req.params.id)
    if (!data) return res.status(404).json({ error: 'Nota no encontrada' })
    res.json(data)
  } catch (e) { next(e) }
}

// POST /api/notas  { id_personaje, tipo_nota, nota, is_done_nota }
const create = async (req, res, next) => {
  try {
    if (!req.body.id_personaje) return res.status(400).json({ error: 'id_personaje requerido' })
    res.status(201).json(await svc.create(req.body))
  } catch (e) { next(e) }
}

// PATCH /api/notas/:id  { tipo_nota, nota, is_done_nota }
const update = async (req, res, next) => {
  try {
    const data = await svc.update(req.params.id, req.body)
    if (!data) return res.status(404).json({ error: 'Nota no encontrada' })
    res.json(data)
  } catch (e) { next(e) }
}

// DELETE /api/notas/:id
const remove = async (req, res, next) => {
  try {
    const ok = await svc.remove(req.params.id)
    if (!ok) return res.status(404).json({ error: 'Nota no encontrada' })
    res.json({ ok: true })
  } catch (e) { next(e) }
}

module.exports = { getAll, getById, create, update, remove }
