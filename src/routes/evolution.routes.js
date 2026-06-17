const router = require('express').Router()
const ctrl   = require('../controllers/evolution.controller')

// GET /api/evolution
router.get('/', ctrl.getAll)

// GET /api/evolution/pokemon/:pokemonId  → cadena evolutiva de un pokemon
router.get('/pokemon/:pokemonId', ctrl.getByPokemon)

module.exports = router
