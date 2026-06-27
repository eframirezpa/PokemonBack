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

const getEquipo = async (req, res, next) => {
  try {
    res.json(await svc.findEquipo(req.params.id))
  } catch (e) { next(e) }
}

const getArmor = async (req, res, next) => {
  try { res.json(await svc.findArmor(req.params.id)) } catch (e) { next(e) }
}

const addArmor = async (req, res, next) => {
  try {
    if (!req.body.id_armor) return res.status(400).json({ error: 'id_armor requerido' })
    res.status(201).json(await svc.addArmor(req.params.id, req.body.id_armor))
  } catch (e) { next(e) }
}

const updateArmorInUse = async (req, res, next) => {
  try {
    res.json(await svc.setArmorInUse(req.params.id, req.params.idArmor, !!req.body.in_use))
  } catch (e) { next(e) }
}

const getWeapon = async (req, res, next) => {
  try { res.json(await svc.findWeapon(req.params.id)) } catch (e) { next(e) }
}

const addWeapon = async (req, res, next) => {
  try {
    if (!req.body.id_weapon) return res.status(400).json({ error: 'id_weapon requerido' })
    res.status(201).json(await svc.addWeapon(req.params.id, req.body.id_weapon))
  } catch (e) { next(e) }
}

const updateWeaponInUse = async (req, res, next) => {
  try {
    res.json(await svc.setWeaponInUse(req.params.id, req.params.idWeapon, !!req.body.in_use))
  } catch (e) { next(e) }
}

const addEquipo = async (req, res, next) => {
  try {
    const { id_item, cantidad } = req.body
    if (!id_item) return res.status(400).json({ error: 'id_item requerido' })
    res.status(201).json(await svc.addEquipo(req.params.id, id_item, cantidad))
  } catch (e) { next(e) }
}

const updateEquipo = async (req, res, next) => {
  try {
    const data = await svc.updateEquipoCantidad(req.params.idEquipo, req.body.cantidad)
    if (!data) return res.status(404).json({ error: 'Item no encontrado' })
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

module.exports = {
  getMine, getById, getFull,
  getEquipo, addEquipo, updateEquipo,
  getArmor, addArmor, updateArmorInUse,
  getWeapon, addWeapon, updateWeaponInUse,
  create,
}
