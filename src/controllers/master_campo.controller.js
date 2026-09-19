const svc = require('../services/master_campo.service')

// GET /api/partida/:id/campo → lo lee toda la mesa
const getCampo = async (req, res, next) => {
  try {
    res.json(await svc.listar(req.params.id))
  } catch (e) { next(e) }
}

// POST /api/partida/:id/campo/pokemon  { id_master_pokemon }
const agregarPokemon = async (req, res, next) => {
  try {
    const id_master_pokemon = Number(req.body?.id_master_pokemon)
    if (!Number.isFinite(id_master_pokemon)) return res.status(400).json({ error: 'Falta id_master_pokemon' })
    const r = await svc.agregarPokemon(req.params.id, req.user.user_id, id_master_pokemon)
    if (r.error === 'notfound') return res.status(404).json({ error: 'Partida no encontrada' })
    if (r.error === 'tope')     return res.status(409).json({ error: `Ya hay ${svc.MAX_POKEMON} Pokémon en el campo` })
    if (r.error === 'invalido') return res.status(400).json({ error: 'Ese Pokémon no es tuyo o ya está en el campo' })
    res.status(201).json(r.campo)
  } catch (e) { next(e) }
}

// POST /api/partida/:id/campo/npc  { id_master_npc }
const agregarNpc = async (req, res, next) => {
  try {
    const id_master_npc = Number(req.body?.id_master_npc)
    if (!Number.isFinite(id_master_npc)) return res.status(400).json({ error: 'Falta id_master_npc' })
    const r = await svc.agregarNpc(req.params.id, req.user.user_id, id_master_npc)
    if (r.error === 'notfound') return res.status(404).json({ error: 'Partida no encontrada' })
    if (r.error === 'tope')     return res.status(409).json({ error: `Ya hay ${svc.MAX_NPC} NPC en el campo` })
    if (r.error === 'invalido') return res.status(400).json({ error: 'Ese NPC no es tuyo o ya está en el campo' })
    res.status(201).json(r.campo)
  } catch (e) { next(e) }
}

// DELETE /api/partida/:id/campo/:idcampo
const quitar = async (req, res, next) => {
  try {
    const r = await svc.quitar(req.params.id, req.user.user_id, req.params.idcampo)
    if (r.error === 'notfound') return res.status(404).json({ error: 'Partida no encontrada' })
    res.status(204).end()
  } catch (e) { next(e) }
}

// PATCH /api/partida/:id/campo/:idcampo  { hidden?, in_ball? }
const actualizar = async (req, res, next) => {
  try {
    const { hidden, in_ball } = req.body || {}
    const r = await svc.actualizar(req.params.id, req.user.user_id, req.params.idcampo, {
      hidden: hidden == null ? null : !!hidden,
      in_ball: in_ball == null ? null : !!in_ball,
    })
    if (r.error === 'notfound') return res.status(404).json({ error: 'No encontrado' })
    res.json(r.campo)
  } catch (e) { next(e) }
}

module.exports = { getCampo, agregarPokemon, agregarNpc, quitar, actualizar }
