const svc = require('../services/terreno.service')

const responder = (res, r) => {
  if (r.error === 'invalido') return res.status(400).json({ error: 'Terreno no válido' })
  if (r.error === 'notfound') return res.status(404).json({ error: 'No encontrado en esta partida' })
  res.json(r)
}

// GET /api/partida/terrenos → catálogo de terrenos
const listar = async (req, res, next) => {
  try { res.json(await svc.listar()) } catch (e) { next(e) }
}

// PATCH /api/partida/:id/terreno/personaje/:idp  { terreno }  (null = ninguno)
const setPersonaje = async (req, res, next) => {
  try { responder(res, await svc.setPersonaje(req.params.id, req.params.idp, req.body?.terreno)) } catch (e) { next(e) }
}

// PATCH /api/partida/:id/terreno/pokemon/:idpp  { terreno }
const setPokemon = async (req, res, next) => {
  try { responder(res, await svc.setPokemon(req.params.id, req.params.idpp, req.body?.terreno)) } catch (e) { next(e) }
}

// PATCH /api/partida/:id/terreno/todos  { terreno }  (null = quitar a todos)
const setTodos = async (req, res, next) => {
  try { responder(res, await svc.setTodos(req.params.id, req.body?.terreno)) } catch (e) { next(e) }
}

module.exports = { listar, setPersonaje, setPokemon, setTodos }
