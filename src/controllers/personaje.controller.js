const svc = require('../services/personaje.service')

// GET /api/personaje?id_partida=123  → personajes del usuario autenticado en esa partida
const getMine = async (req, res, next) => {
  try {
    const id_partida = Number(req.query.id_partida)
    if (!id_partida) return res.status(400).json({ error: 'id_partida requerido' })
    res.json(await svc.findByPartidaUser(id_partida, req.user.user_id))
  } catch (e) { next(e) }
}

const getById = async (req, res, next) => {
  try {
    const data = await svc.findById(req.params.id)
    if (!data) return res.status(404).json({ error: 'Personaje no encontrado' })
    res.json(data)
  } catch (e) { next(e) }
}

const getFull = async (req, res, next) => {
  try {
    const data = await svc.findFullById(req.params.id)
    if (!data) return res.status(404).json({ error: 'Personaje no encontrado' })
    res.json(data)
  } catch (e) { next(e) }
}

// POST /api/personaje  { id_partida, nombre_personaje, personaje_origin, ... }
const create = async (req, res, next) => {
  try {
    const { id_partida, ...data } = req.body
    if (!id_partida) return res.status(400).json({ error: 'id_partida requerido' })
    const personaje = await svc.create(Number(id_partida), req.user.user_id, data)
    if (!personaje) return res.status(404).json({ error: 'No estás asociado a esta partida' })
    res.status(201).json(personaje)
  } catch (e) { next(e) }
}

module.exports = { getMine, getById, getFull, create }
