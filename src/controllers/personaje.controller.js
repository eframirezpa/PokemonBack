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

// PATCH /api/personaje/:id/combate → HP actual / exhaust / dsts / dstf del personaje
const updateCombate = async (req, res, next) => {
  try {
    const { current_hp, exhaust_lvl, dsts, dstf } = req.body
    res.json(await svc.updateCombate(req.params.id, { current_hp, exhaust_lvl, dsts, dstf }) || {})
  } catch (e) { next(e) }
}

// PATCH /api/personaje/:id/pokemon/:idpp/combate → HP actual / exhaust / dsts / dstf del pokémon
const updatePokemonCombate = async (req, res, next) => {
  try {
    const { current_hp, exhaust_lvl, dsts, dstf } = req.body
    res.json(await svc.updatePokemonCombate(req.params.idpp, { current_hp, exhaust_lvl, dsts, dstf }) || {})
  } catch (e) { next(e) }
}

// GET /api/personaje/party?id_partida=123 → personajes de la partida + pokémon del cinturón
const getParty = async (req, res, next) => {
  try {
    const id_partida = Number(req.query.id_partida)
    if (!id_partida) return res.status(400).json({ error: 'id_partida requerido' })
    res.json(await svc.findParty(id_partida))
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

const getPokemon = async (req, res, next) => {
  try {
    const { en_equipo } = req.query
    const filtro = en_equipo === undefined ? null
      : (en_equipo === '1' || en_equipo === 'true')
    res.json(await svc.findPokemon(req.params.id, filtro))
  } catch (e) { next(e) }
}

const getPokemonDetail = async (req, res, next) => {
  try {
    const data = await svc.findPokemonDetail(req.params.idpp)
    if (!data) return res.status(404).json({ error: 'Pokémon no encontrado' })
    res.json(data)
  } catch (e) { next(e) }
}

const updatePokemonEnEquipo = async (req, res, next) => {
  try {
    const result = await svc.setPokemonEnEquipo(req.params.id, req.params.idpp, !!req.body.en_equipo)
    if (result && result.full) {
      return res.status(409).json({ error: 'El cinturón ya tiene 6 Pokémon' })
    }
    if (!result) return res.status(404).json({ error: 'Pokémon no encontrado' })
    res.json(result)
  } catch (e) { next(e) }
}

const addPokemon = async (req, res, next) => {
  try {
    const { id_pokemon, apodo, genero, id_nature, id_bond, move_ids, is_shiny, id_abilitie } = req.body
    if (!id_pokemon) return res.status(400).json({ error: 'id_pokemon requerido' })
    const created = await svc.addPokemon(req.params.id, { id_pokemon, apodo, genero, id_nature, id_bond, move_ids, is_shiny, id_abilitie })
    if (!created) return res.status(404).json({ error: 'Pokémon no encontrado' })
    res.status(201).json(created)
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

// GET /api/personaje/:id/feats → feats extra del personaje (con detalle)
const getFeats = async (req, res, next) => {
  try {
    res.json(await svc.findFeats(req.params.id))
  } catch (e) { next(e) }
}

// POST /api/personaje/:id/feats  { feat_id } → agrega un feat (solo General)
const addFeat = async (req, res, next) => {
  try {
    const feat_id = Number(req.body.feat_id)
    if (!feat_id) return res.status(400).json({ error: 'feat_id requerido' })
    const result = await svc.addFeat(req.params.id, feat_id, req.body.choices)
    if (result.error === 'notfound') return res.status(404).json({ error: 'Feat no encontrado' })
    if (result.error === 'type')     return res.status(400).json({ error: 'Solo se pueden agregar feats de tipo General u Origin' })
    if (result.error === 'duplicate') return res.status(409).json({ error: 'El personaje ya tiene ese rasgo' })
    if (result.error === 'choices')   return res.status(400).json({ error: 'Debes completar las elecciones del rasgo (atributos/habilidades)' })
    if (result.error === 'prereq')    return res.status(400).json({ error: 'El personaje no cumple los prerequisitos del rasgo' })
    res.status(201).json(result)
  } catch (e) { next(e) }
}

// DELETE /api/personaje/:id/feats/:idpf → elimina un feat extra del personaje
const removeFeat = async (req, res, next) => {
  try {
    const ok = await svc.removeFeat(req.params.id, req.params.idpf)
    if (!ok) return res.status(404).json({ error: 'Rasgo no encontrado' })
    res.json({ ok: true })
  } catch (e) { next(e) }
}

// PATCH /api/personaje/:id/editable  { is_editable } → activa/desactiva la edición
const setEditable = async (req, res, next) => {
  try {
    const data = await svc.setEditable(req.params.id, !!req.body.is_editable)
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

module.exports = {
  getMine, getParty, getById, getFull, updateCombate, updatePokemonCombate,
  getEquipo, addEquipo, updateEquipo,
  getArmor, addArmor, updateArmorInUse,
  getWeapon, addWeapon, updateWeaponInUse,
  getPokemon, getPokemonDetail, updatePokemonEnEquipo, addPokemon,
  getFeats, addFeat, removeFeat, setEditable,
  create,
}
