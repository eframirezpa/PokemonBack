const svc = require('../services/evolution.service')

const getAll = async (req, res, next) => {
  try {
    const { limit = 20, offset = 0 } = req.query
    res.json(await svc.findAll({ limit: Number(limit), offset: Number(offset) }))
  } catch (e) { next(e) }
}

const getByPokemon = async (req, res, next) => {
  try {
    const data = await svc.findByPokemonId(req.params.pokemonId)
    res.json(data)
  } catch (e) { next(e) }
}

module.exports = { getAll, getByPokemon }
