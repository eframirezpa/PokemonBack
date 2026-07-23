const svc = require('../services/master_pokemon.service')

// GET /api/master/pokemon?en_equipo=1 → Pokémon del master autenticado
const getPokemon = async (req, res, next) => {
  try {
    const { en_equipo } = req.query
    const filtro = en_equipo === undefined ? null
      : (en_equipo === '1' || en_equipo === 'true')
    res.json(await svc.findPokemon(req.user.user_id, filtro))
  } catch (e) { next(e) }
}

// GET /api/master/pokemon/level-preview?id_pokemon=&level= → valores por defecto según el nivel
const getLevelPreview = async (req, res, next) => {
  try {
    const id_pokemon = Number(req.query.id_pokemon)
    const level = Number(req.query.level)
    if (!id_pokemon) return res.status(400).json({ error: 'id_pokemon requerido' })
    const data = await svc.levelPreview(id_pokemon, level)
    if (!data) return res.status(404).json({ error: 'Pokémon no encontrado' })
    res.json(data)
  } catch (e) { next(e) }
}

// GET /api/master/pokemon/:idmp → detalle completo
const getPokemonDetail = async (req, res, next) => {
  try {
    const data = await svc.findPokemonDetail(req.params.idmp)
    if (!data) return res.status(404).json({ error: 'Pokémon no encontrado' })
    res.json(data)
  } catch (e) { next(e) }
}

// POST /api/master/pokemon → agrega un Pokémon al master
const addPokemon = async (req, res, next) => {
  try {
    const { id_pokemon, apodo, genero, id_nature, id_bond, move_ids, is_shiny, id_abilitie,
            type_1, type_2, hp, stats, skills, level, proficiency, experiencia } = req.body
    if (!id_pokemon) return res.status(400).json({ error: 'id_pokemon requerido' })
    const created = await svc.addPokemon(req.user.user_id, {
      id_pokemon, apodo, genero, id_nature, id_bond, move_ids, is_shiny, id_abilitie,
      type_1, type_2, hp, stats, skills, level, proficiency, experiencia,
    })
    if (!created) return res.status(404).json({ error: 'Pokémon no encontrado' })
    res.status(201).json(created)
  } catch (e) { next(e) }
}

// PATCH /api/master/pokemon/:idmp/combate → HP actual / exhaust / dsts / dstf
const updatePokemonCombate = async (req, res, next) => {
  try {
    const { current_hp, exhaust_lvl, dsts, dstf } = req.body
    res.json(await svc.updatePokemonCombate(req.params.idmp, { current_hp, exhaust_lvl, dsts, dstf }) || {})
  } catch (e) { next(e) }
}

// PATCH /api/master/pokemon/:idmp/en-equipo → cinturón (máx. 6)
const updatePokemonEnEquipo = async (req, res, next) => {
  try {
    const result = await svc.setPokemonEnEquipo(req.user.user_id, req.params.idmp, !!req.body.en_equipo)
    if (result && result.full) return res.status(409).json({ error: 'El cinturón ya tiene 6 Pokémon' })
    if (!result) return res.status(404).json({ error: 'Pokémon no encontrado' })
    res.json(result)
  } catch (e) { next(e) }
}

// PATCH /api/master/pokemon/:idmp/en-juego → marca / desmarca el Pokémon invocado
const updatePokemonEnJuego = async (req, res, next) => {
  try {
    const result = await svc.setPokemonEnJuego(req.user.user_id, req.params.idmp, !!req.body.en_juego)
    if (!result) return res.status(404).json({ error: 'Pokémon no encontrado' })
    res.json(result)
  } catch (e) { next(e) }
}

// PATCH /api/master/pokemon/:idmp → edita los campos del Pokémon del master
const updatePokemon = async (req, res, next) => {
  try {
    const { apodo, genero, id_nature, type_1, type_2, hp, stats, skills, move_ids, id_abilitie } = req.body
    const updated = await svc.updatePokemon(req.user.user_id, req.params.idmp, {
      apodo, genero, id_nature, type_1, type_2, hp, stats, skills, move_ids, id_abilitie,
    })
    if (!updated) return res.status(404).json({ error: 'Pokémon no encontrado' })
    res.json(updated)
  } catch (e) { next(e) }
}

// DELETE /api/master/pokemon/:idmp → elimina un Pokémon del master
const removePokemon = async (req, res, next) => {
  try {
    const ok = await svc.removePokemon(req.user.user_id, req.params.idmp)
    if (!ok) return res.status(404).json({ error: 'Pokémon no encontrado' })
    res.json({ ok: true })
  } catch (e) { next(e) }
}

module.exports = {
  getPokemon, getPokemonDetail, getLevelPreview, addPokemon, updatePokemon,
  updatePokemonCombate, updatePokemonEnEquipo, updatePokemonEnJuego, removePokemon,
}
