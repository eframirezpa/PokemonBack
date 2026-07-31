const svc = require('../services/personaje_pokemon_feat.service')

// GET /api/personaje/:id/pokemon/:idpp/feats → feats del Pokémon del entrenador
const getFeats = async (req, res, next) => {
  try {
    res.json(await svc.findByPokemon(req.params.idpp))
  } catch (e) { next(e) }
}

// POST /api/personaje/:id/pokemon/:idpp/feats  { feat_id, bonos } → agrega un feat con sus bonos
const addFeat = async (req, res, next) => {
  try {
    const feat_id = Number(req.body.feat_id)
    if (!feat_id) return res.status(400).json({ error: 'feat_id requerido' })
    const result = await svc.addFeat(req.params.idpp, feat_id, req.body.bonos)
    if (result.error === 'notfound')     return res.status(404).json({ error: 'Pokémon no encontrado' })
    if (result.error === 'featnotfound') return res.status(404).json({ error: 'Feat no encontrado' })
    if (result.error === 'duplicate')    return res.status(409).json({ error: 'El Pokémon ya tiene ese rasgo' })
    res.status(201).json(result)
  } catch (e) { next(e) }
}

// DELETE /api/personaje/:id/pokemon/:idpp/feats/:idfeat → elimina un feat del Pokémon
const removeFeat = async (req, res, next) => {
  try {
    const ok = await svc.removeFeat(req.params.idpp, req.params.idfeat)
    if (!ok) return res.status(404).json({ error: 'Rasgo no encontrado' })
    res.json({ ok: true })
  } catch (e) { next(e) }
}

// PATCH /api/personaje/:id/pokemon/:idpp/feats/:idfeat/available  { is_available }
const setFeatAvailable = async (req, res, next) => {
  try {
    const ok = await svc.setFeatAvailable(req.params.idpp, req.params.idfeat, !!req.body.is_available)
    if (!ok) return res.status(404).json({ error: 'Rasgo no encontrado' })
    res.json({ ok: true })
  } catch (e) { next(e) }
}

module.exports = { getFeats, addFeat, removeFeat, setFeatAvailable }
