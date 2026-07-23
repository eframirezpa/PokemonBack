const router = require('express').Router()
const ctrl   = require('../controllers/master_pokemon.controller')
const { authenticate } = require('../middleware/auth.middleware')

// Pokémon del master autenticado (id_master = req.user.user_id)
router.get('/',                    authenticate, ctrl.getPokemon)
router.post('/',                   authenticate, ctrl.addPokemon)
router.get('/:idmp',               authenticate, ctrl.getPokemonDetail)
router.patch('/:idmp',             authenticate, ctrl.updatePokemon)
router.patch('/:idmp/combate',     authenticate, ctrl.updatePokemonCombate)
router.patch('/:idmp/en-equipo',   authenticate, ctrl.updatePokemonEnEquipo)
router.patch('/:idmp/en-juego',    authenticate, ctrl.updatePokemonEnJuego)
router.delete('/:idmp',            authenticate, ctrl.removePokemon)

module.exports = router
