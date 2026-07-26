const svc = require('../services/master_pokemon_feat.service')

// GET /api/master/pokemon/:idmp/feats → feats del Pokémon del master
const getFeats = async (req, res, next) => {
  try {
    const data = await svc.findByPokemon(req.user.user_id, req.params.idmp)
    if (data === null) return res.status(404).json({ error: 'Pokémon no encontrado' })
    res.json(data)
  } catch (e) { next(e) }
}

// POST /api/master/pokemon/:idmp/feats  { feat_id, bonos } → agrega un feat con sus bonos
const addFeat = async (req, res, next) => {
  try {
    const feat_id = Number(req.body.feat_id)
    if (!feat_id) return res.status(400).json({ error: 'feat_id requerido' })
    const result = await svc.addFeat(req.user.user_id, req.params.idmp, feat_id, req.body.bonos)
    if (result.error === 'notfound')     return res.status(404).json({ error: 'Pokémon no encontrado' })
    if (result.error === 'featnotfound') return res.status(404).json({ error: 'Feat no encontrado' })
    if (result.error === 'duplicate')    return res.status(409).json({ error: 'El Pokémon ya tiene ese rasgo' })
    res.status(201).json(result)
  } catch (e) { next(e) }
}

// DELETE /api/master/pokemon/:idmp/feats/:idfeat → elimina un feat del Pokémon
const removeFeat = async (req, res, next) => {
  try {
    const ok = await svc.removeFeat(req.user.user_id, req.params.idmp, req.params.idfeat)
    if (!ok) return res.status(404).json({ error: 'Rasgo no encontrado' })
    res.json({ ok: true })
  } catch (e) { next(e) }
}

// PATCH /api/master/pokemon/:idmp/feats/:idfeat/available  { is_available }
const setFeatAvailable = async (req, res, next) => {
  try {
    const ok = await svc.setFeatAvailable(req.user.user_id, req.params.idmp, req.params.idfeat, !!req.body.is_available)
    if (!ok) return res.status(404).json({ error: 'Rasgo no encontrado' })
    res.json({ ok: true })
  } catch (e) { next(e) }
}

module.exports = { getFeats, addFeat, removeFeat, setFeatAvailable }
