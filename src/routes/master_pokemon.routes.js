const router = require('express').Router()
const ctrl   = require('../controllers/master_pokemon.controller')
const featCtrl = require('../controllers/master_pokemon_feat.controller')
const { authenticate } = require('../middleware/auth.middleware')

// Pokémon del master autenticado (id_master = req.user.user_id)
router.get('/',                    authenticate, ctrl.getPokemon)
router.post('/',                   authenticate, ctrl.addPokemon)
router.get('/level-preview',       authenticate, ctrl.getLevelPreview)
router.get('/:idmp',               authenticate, ctrl.getPokemonDetail)
router.patch('/:idmp',             authenticate, ctrl.updatePokemon)
router.patch('/:idmp/combate',     authenticate, ctrl.updatePokemonCombate)
router.patch('/:idmp/en-equipo',   authenticate, ctrl.updatePokemonEnEquipo)
router.patch('/:idmp/en-juego',    authenticate, ctrl.updatePokemonEnJuego)
router.delete('/:idmp',            authenticate, ctrl.removePokemon)

// Feats del Pokémon del master
router.get('/:idmp/feats',                     authenticate, featCtrl.getFeats)
router.post('/:idmp/feats',                    authenticate, featCtrl.addFeat)
router.delete('/:idmp/feats/:idfeat',          authenticate, featCtrl.removeFeat)
router.patch('/:idmp/feats/:idfeat/available', authenticate, featCtrl.setFeatAvailable)

module.exports = router
