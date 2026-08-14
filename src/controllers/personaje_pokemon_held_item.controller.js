const svc = require('../services/personaje_pokemon_held_item.service')
const { query } = require('../config/db')

// GET /api/personaje/:id/pokemon/:idpp/held-items
// Devuelve los objetos equipados y CUÁNTOS puede llevar. El tope sale de sus
// feats, así que solo lo sabe el servidor: el cliente no debe deducirlo.
const getHeldItems = async (req, res, next) => {
  try {
    const [items, maximo] = await Promise.all([
      svc.findByPokemon(req.params.idpp),
      svc.huecosDeObjeto(query, req.params.idpp),
    ])
    res.json({ items, maximo })
  } catch (e) { next(e) }
}

// POST /api/personaje/:id/pokemon/:idpp/held-items  { id_item }
// Equipa un objeto: lo descuenta de la mochila del entrenador.
const addHeldItem = async (req, res, next) => {
  try {
    const id_item = Number(req.body.id_item)
    if (!id_item) return res.status(400).json({ error: 'id_item requerido' })
    const r = await svc.addHeldItem(req.params.id, req.params.idpp, id_item)
    if (r.error === 'notfound') return res.status(404).json({ error: 'Pokémon no encontrado' })
    if (r.error === 'sinitem')  return res.status(409).json({ error: 'No tienes ese item en la mochila' })
    if (r.error === 'lleno')    return res.status(409).json({ error: 'El Pokémon ya lleva un objeto' })
    res.status(201).json(r)
  } catch (e) { next(e) }
}

// DELETE /api/personaje/:id/pokemon/:idpp/held-items/:idhi
// Quita el objeto y lo devuelve a la mochila.
const removeHeldItem = async (req, res, next) => {
  try {
    const r = await svc.removeHeldItem(req.params.id, req.params.idpp, req.params.idhi)
    if (r.error === 'notfound') return res.status(404).json({ error: 'Objeto equipado no encontrado' })
    res.json(r)
  } catch (e) { next(e) }
}

// POST /api/personaje/:id/pokemon/:idpp/held-items/:idhi/usar
// Consume el objeto: NO vuelve a la mochila. Ruta aparte del borrado a
// propósito, porque es irreversible.
const useHeldItem = async (req, res, next) => {
  try {
    const ok = await svc.useHeldItem(req.params.idpp, req.params.idhi)
    if (!ok) return res.status(404).json({ error: 'Objeto equipado no encontrado' })
    res.json({ ok: true })
  } catch (e) { next(e) }
}

module.exports = { getHeldItems, addHeldItem, removeHeldItem, useHeldItem }
