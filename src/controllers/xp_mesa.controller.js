const svc = require('../services/xp_mesa.service')

const ERRORES = {
  notfound:  [404, 'No encontrado'],
  ajeno:     [403, 'Ese personaje o Pokémon no es tuyo en esta partida'],
  tipo:      [400, 'Tipo de intervención inválido'],
  datos:     [400, 'Faltan datos'],
  motivo:    [400, 'Motivo inválido'],
  sinxp:     [422, 'Este Pokémon no tiene experiencia calculable (SR variable): a criterio del DM'],
  resuelta:  [409, 'Esa experiencia ya se resolvió'],
  vacio:     [400, 'Elige al menos un entrenador'],
  personaje: [400, 'Hay un entrenador que no es de esta partida'],
  cantidad:  [400, 'Cantidad inválida'],
  repetido:  [400, 'Entrenador repetido'],
  excede:    [400, 'El reparto pasa del total'],
}
const responder = (res, r, ok = 200) => {
  if (r?.error) {
    const [status, error] = ERRORES[r.error] || [400, 'Petición inválida']
    return res.status(status).json({ error, codigo: r.error })
  }
  return res.status(ok).json(r)
}
const int = (v) => (v == null || v === '' ? null : Number(v))

// POST /api/partida/:id/intervencion { id_campo, id_personaje, id_personaje_pokemon?, tipo }
const registrarIntervencion = async (req, res, next) => {
  try {
    const b = req.body || {}
    const r = await svc.registrarIntervencion(Number(req.params.id), req.user.user_id, {
      id_campo: int(b.id_campo), id_personaje: int(b.id_personaje),
      id_personaje_pokemon: int(b.id_personaje_pokemon), tipo: b.tipo,
    })
    responder(res, r, 201)
  } catch (e) { next(e) }
}

// POST /api/partida/:id/xp { id_campo, pokemon, nivel, sr, motivo } (máster)
const crearXp = async (req, res, next) => {
  try {
    const b = req.body || {}
    const r = await svc.crearXp(Number(req.params.id), req.user.user_id, {
      id_campo: int(b.id_campo), pokemon: b.pokemon, nivel: b.nivel, sr: b.sr, motivo: b.motivo,
    })
    responder(res, r, 201)
  } catch (e) { next(e) }
}

// GET /api/partida/:id/xp (máster): lo pendiente con quién intervino
const pendientesDm = async (req, res, next) => {
  try { responder(res, await svc.pendientesDm(Number(req.params.id), req.user.user_id)) } catch (e) { next(e) }
}

// POST /api/partida/:id/xp/:idxp/confirmar { reparto: [{ id_personaje, xp }] } (máster)
const confirmar = async (req, res, next) => {
  try {
    responder(res, await svc.confirmar(Number(req.params.id), req.user.user_id, Number(req.params.idxp), req.body?.reparto))
  } catch (e) { next(e) }
}

// POST /api/partida/:id/xp/:idxp/manual (máster): cerrar e ignorar
const manual = async (req, res, next) => {
  try { responder(res, await svc.manual(Number(req.params.id), req.user.user_id, Number(req.params.idxp))) } catch (e) { next(e) }
}

// GET /api/partida/:id/xp/personaje/:idp → las partes que ese entrenador aún no reparte
const pendientesEntrenador = async (req, res, next) => {
  try {
    responder(res, await svc.pendientesEntrenador(Number(req.params.id), Number(req.params.idp), req.user.user_id))
  } catch (e) { next(e) }
}

module.exports = { registrarIntervencion, crearXp, pendientesDm, confirmar, manual, pendientesEntrenador }
