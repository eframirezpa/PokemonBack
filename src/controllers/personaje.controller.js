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
    const { current_hp, exhaust_lvl, dsts, dstf, sr } = req.body
    res.json(await svc.updateCombate(req.params.id, { current_hp, exhaust_lvl, dsts, dstf, sr }) || {})
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
      return res.status(409).json({ error: `El cinturón ya tiene ${result.slots} Pokémon`, slots: result.slots })
    }
    if (!result) return res.status(404).json({ error: 'Pokémon no encontrado' })
    res.json(result)
  } catch (e) { next(e) }
}

// PATCH /personaje/:id/pokemon/:idpp/en-juego → marca / desmarca el Pokémon invocado
const updatePokemonEnJuego = async (req, res, next) => {
  try {
    const result = await svc.setPokemonEnJuego(req.params.id, req.params.idpp, !!req.body.en_juego)
    if (!result) return res.status(404).json({ error: 'Pokémon no encontrado' })
    res.json(result)
  } catch (e) { next(e) }
}

// PATCH /personaje/:id/pokemon/:idpp/experiencia  { cantidad } → suma experiencia al Pokémon
const addPokemonExperience = async (req, res, next) => {
  try {
    const result = await svc.addPokemonExperience(req.params.idpp, req.body.cantidad)
    if (result.error === 'notfound')  return res.status(404).json({ error: 'Pokémon no encontrado' })
    if (result.error === 'amount')    return res.status(400).json({ error: 'Cantidad inválida' })
    if (result.error === 'max')       return res.status(409).json({ error: 'El Pokémon ya está en el nivel máximo' })
    if (result.error === 'nomargin')  return res.status(409).json({ error: 'No hay margen de experiencia para agregar' })
    if (result.error === 'toomuch')   return res.status(409).json({ error: `El máximo a agregar es ${result.max}`, max: result.max })
    res.json(result)
  } catch (e) { next(e) }
}

const addPokemon = async (req, res, next) => {
  try {
    const { id_pokemon, apodo, genero, id_nature, id_bond, move_ids, is_shiny, id_abilitie } = req.body
    if (!id_pokemon) return res.status(400).json({ error: 'id_pokemon requerido' })
    const created = await svc.addPokemon(req.params.id, { id_pokemon, apodo, genero, id_nature, id_bond, move_ids, is_shiny, id_abilitie })
    if (created?.error === 'starter') {
      return res.status(409).json({ error: 'Este personaje ya recibió su Pokémon inicial' })
    }
    if (!created) return res.status(404).json({ error: 'Pokémon no encontrado' })
    res.status(201).json(created)
  } catch (e) { next(e) }
}

// PATCH /personaje/:id/path-resource/:idb  { cantidad } → gasta puntos
const spendPathResource = async (req, res, next) => {
  try {
    const r = await svc.spendPathResource(req.params.id, req.params.idb, req.body.cantidad)
    if (r.error === 'notfound')     return res.status(404).json({ error: 'Recurso no encontrado' })
    if (r.error === 'insufficient') return res.status(409).json({ error: 'No quedan puntos suficientes', actual: r.actual })
    res.json(r)
  } catch (e) { next(e) }
}

// PUT /personaje/:id/path-resource/:idb  { actual } → fija el valor (el lápiz)
const setPathResource = async (req, res, next) => {
  try {
    const r = await svc.setPathResource(req.params.id, req.params.idb, req.body.actual)
    if (r.error === 'notfound') return res.status(404).json({ error: 'Recurso no encontrado' })
    res.json(r)
  } catch (e) { next(e) }
}

// ── Dados de golpe ──────────────────────────────────────────────────────────
// Mismas respuestas que los recursos de ruta: 404 si no existe, 409 si no
// quedan dados. El 409 devuelve el valor real para que la UI se reconcilie.
const responderDados = (res, r) => {
  if (r.error === 'notfound')     return res.status(404).json({ error: 'No encontrado' })
  if (r.error === 'insufficient') return res.status(409).json({ error: 'No quedan dados de golpe', actual: r.actual, maximo: r.maximo })
  res.json(r)
}

// PATCH /personaje/:id/hit-dice  { cantidad } → gasta dados del entrenador
const spendHitDice = async (req, res, next) => {
  try { responderDados(res, await svc.spendHitDice(req.params.id, req.body.cantidad)) }
  catch (e) { next(e) }
}

// PUT /personaje/:id/hit-dice  { actual } → fija los dados del entrenador
const setHitDice = async (req, res, next) => {
  try { responderDados(res, await svc.setHitDice(req.params.id, req.body.actual)) }
  catch (e) { next(e) }
}

// PATCH /personaje/:id/pokemon/:idpp/hit-dice  { cantidad } → gasta dados del Pokémon
const spendHitDicePokemon = async (req, res, next) => {
  try { responderDados(res, await svc.spendHitDicePokemon(req.params.id, req.params.idpp, req.body.cantidad)) }
  catch (e) { next(e) }
}

// PUT /personaje/:id/pokemon/:idpp/hit-dice  { actual } → fija los dados del Pokémon
const setHitDicePokemon = async (req, res, next) => {
  try { responderDados(res, await svc.setHitDicePokemon(req.params.id, req.params.idpp, req.body.actual)) }
  catch (e) { next(e) }
}

// PATCH /personaje/:id/pokemon/:idpp/bond-points  { cantidad } → gasta puntos
const spendBondPoints = async (req, res, next) => {
  try { responderDados(res, await svc.gastarBondPoints(req.params.id, req.params.idpp, req.body.cantidad)) }
  catch (e) { next(e) }
}

// PUT /personaje/:id/pokemon/:idpp/bond-points  { actual } → fija los puntos
const setBondPoints = async (req, res, next) => {
  try { responderDados(res, await svc.fijarBondPoints(req.params.id, req.params.idpp, req.body.actual)) }
  catch (e) { next(e) }
}

// GET /personaje/:id/pokemon/:idpp/bond → los tres vínculos entre los que puede moverse
const getBondOpciones = async (req, res, next) => {
  try {
    const r = await svc.bondOpciones(req.params.idpp)
    if (r.error === 'notfound') return res.status(404).json({ error: 'Pokémon no encontrado' })
    res.json(r)
  } catch (e) { next(e) }
}

// PUT /personaje/:id/pokemon/:idpp/bond  { bond_id } → mueve el vínculo un escalón
const updateBondPoints = async (req, res, next) => {
  try {
    const r = await svc.updateBondPoints(req.params.id, req.params.idpp, req.body.bond_id)
    if (r.error === 'notfound') return res.status(404).json({ error: 'Pokémon no encontrado' })
    if (r.error === 'fuera_de_rango') return res.status(400).json({ error: 'Solo se puede subir o bajar un nivel', opciones: r.opciones })
    res.json(r)
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

// POST /api/personaje/:id/specializations { id_specialization } → agrega una especialización y sus bonos
const addSpecialization = async (req, res, next) => {
  try {
    const id_specialization = Number(req.body.id_specialization)
    if (!id_specialization) return res.status(400).json({ error: 'id_specialization requerido' })
    const result = await svc.addSpecialization(req.params.id, id_specialization)
    if (result.error === 'notfound')  return res.status(404).json({ error: 'Especialización no encontrada' })
    if (result.error === 'duplicate') return res.status(409).json({ error: 'El personaje ya tiene esa especialización' })
    res.status(201).json(result)
  } catch (e) { next(e) }
}

// DELETE /api/personaje/:id/specializations/:idspec → elimina una especialización y sus bonos
const removeSpecialization = async (req, res, next) => {
  try {
    const ok = await svc.removeSpecialization(req.params.id, req.params.idspec)
    if (!ok) return res.status(404).json({ error: 'Especialización no encontrada' })
    res.json({ ok: true })
  } catch (e) { next(e) }
}

// PATCH /api/personaje/:id/feats/:idpf/available { is_available } → alterna disponibilidad de un rasgo extra
const setFeatAvailable = async (req, res, next) => {
  try {
    const ok = await svc.setFeatAvailable(req.params.id, req.params.idpf, !!req.body.is_available)
    if (!ok) return res.status(404).json({ error: 'Rasgo no encontrado' })
    res.json({ ok: true })
  } catch (e) { next(e) }
}

// DELETE /api/personaje/:id/feats/:idpf → elimina un feat extra del personaje
const removeFeat = async (req, res, next) => {
  try {
    const ok = await svc.removeFeat(req.params.id, req.params.idpf)
    if (ok && ok.error === 'granted') {
      return res.status(409).json({ error: 'Ese rasgo lo otorgan el origen o el background y no se puede quitar' })
    }
    if (!ok) return res.status(404).json({ error: 'Rasgo no encontrado' })
    res.json({ ok: true })
  } catch (e) { next(e) }
}

// PATCH /api/personaje/:id/pokedollars  { cantidad } → descuenta pokédollars (compra)
const spendPokedollars = async (req, res, next) => {
  try {
    const cantidad = Number(req.body.cantidad)
    if (!Number.isFinite(cantidad) || cantidad < 0) return res.status(400).json({ error: 'Cantidad inválida' })
    const result = await svc.spendPokedollars(req.params.id, cantidad)
    if (result.error === 'notfound')     return res.status(404).json({ error: 'Personaje no encontrado' })
    if (result.error === 'insufficient') return res.status(409).json({ error: 'No tienes suficientes pokédollars', pokedollars: result.pokedollars })
    res.json(result)
  } catch (e) { next(e) }
}

// PATCH /api/personaje/:id/pokedollars/add  { cantidad } → suma pokédollars
const addPokedollars = async (req, res, next) => {
  try {
    const cantidad = Number(req.body.cantidad)
    if (!Number.isFinite(cantidad) || cantidad <= 0) return res.status(400).json({ error: 'Cantidad inválida' })
    const result = await svc.addPokedollars(req.params.id, cantidad)
    if (result.error === 'notfound') return res.status(404).json({ error: 'Personaje no encontrado' })
    if (result.error === 'toomuch')  return res.status(400).json({ error: `El máximo a agregar es ${result.max.toLocaleString()} ₽`, max: result.max })
    if (result.error === 'maxtotal') return res.status(409).json({ error: `No puedes superar ${result.max.toLocaleString()} ₽`, max: result.max, pokedollars: result.pokedollars })
    res.json(result)
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
  } catch (e) {
    // El origen o el background otorgan Skilled y no llegaron sus 3 elecciones:
    // es un error del cliente, no del servidor. La transacción ya hizo rollback.
    if (e.message === 'skilled_choices') {
      return res.status(400).json({ error: 'Faltan las elecciones del feat Skilled' })
    }
    next(e)
  }
}

// GET /api/personaje/:id/pokemon/pending-rename → Pokémon recién recibidos
const pendingRenames = async (req, res, next) => {
  try {
    res.json(await svc.pendingRenames(req.params.id))
  } catch (e) { next(e) }
}

// PATCH /api/personaje/:id/pokemon/:idpp/moves/:idrow/pp  { cantidad }
const spendMovePP = async (req, res, next) => {
  try {
    const r = await svc.spendMovePP(req.params.id, req.params.idpp, req.params.idrow, req.body.cantidad)
    if (r.error === 'cantidad')     return res.status(400).json({ error: 'Cantidad inválida' })
    if (r.error === 'notfound')     return res.status(404).json({ error: 'Movimiento no encontrado' })
    if (r.error === 'insufficient') return res.status(409).json({ error: 'No tiene suficientes PP', current_pp: r.current_pp })
    res.json(r)
  } catch (e) { next(e) }
}

// PUT /api/personaje/:id/pokemon/:idpp/moves/:idrow/pp  { current_pp, max_pp }
const setMovePP = async (req, res, next) => {
  try {
    const r = await svc.setMovePP(req.params.id, req.params.idpp, req.params.idrow, req.body.current_pp, req.body.max_pp)
    if (r.error === 'cantidad') return res.status(400).json({ error: 'Cantidad inválida' })
    if (r.error === 'notfound') return res.status(404).json({ error: 'Movimiento no encontrado' })
    res.json(r)
  } catch (e) { next(e) }
}

// PATCH /api/personaje/:id/pokemon/:idpp/apodo  { apodo }
const renamePokemon = async (req, res, next) => {
  try {
    const r = await svc.renamePokemon(req.params.id, req.params.idpp, req.body.apodo)
    if (r.error === 'apodo')    return res.status(400).json({ error: 'El apodo no puede estar vacío' })
    if (r.error === 'notfound') return res.status(404).json({ error: 'Pokémon no encontrado' })
    res.json(r)
  } catch (e) { next(e) }
}

// DELETE /api/personaje/:id/pokemon/:idpp → libera (borra) el Pokémon
const releasePokemon = async (req, res, next) => {
  try {
    const r = await svc.releasePokemon(req.params.id, req.params.idpp)
    if (r.error === 'notfound') return res.status(404).json({ error: 'Pokémon no encontrado' })
    res.json(r)
  } catch (e) { next(e) }
}

// POST /api/personaje/:id/pokemon/:idpp/transfer  { id_personaje_destino }
const transferPokemon = async (req, res, next) => {
  try {
    const destino = Number(req.body.id_personaje_destino)
    if (!destino) return res.status(400).json({ error: 'id_personaje_destino requerido' })
    const r = await svc.transferPokemonToPersonaje(req.params.id, req.params.idpp, destino)
    if (r.error === 'notfound')           return res.status(404).json({ error: 'Pokémon no encontrado' })
    if (r.error === 'personajenotfound')  return res.status(404).json({ error: 'Personaje destino no encontrado' })
    if (r.error === 'mismo')              return res.status(400).json({ error: 'El destino es el mismo entrenador' })
    res.json(r)
  } catch (e) { next(e) }
}

module.exports = {
  getMine, getParty, getById, getFull, updateCombate, updatePokemonCombate,
  getEquipo, addEquipo, updateEquipo,
  getArmor, addArmor, updateArmorInUse,
  getWeapon, addWeapon, updateWeaponInUse,
  spendPathResource, setPathResource, updateBondPoints, getBondOpciones, spendBondPoints, setBondPoints,
  spendHitDice, setHitDice, spendHitDicePokemon, setHitDicePokemon,
  getPokemon, getPokemonDetail, updatePokemonEnEquipo, updatePokemonEnJuego, addPokemon, addPokemonExperience,
  renamePokemon, releasePokemon, transferPokemon, pendingRenames, spendMovePP, setMovePP,
  getFeats, addFeat, removeFeat, setFeatAvailable, setEditable, spendPokedollars, addPokedollars,
  addSpecialization, removeSpecialization,
  create,
}
