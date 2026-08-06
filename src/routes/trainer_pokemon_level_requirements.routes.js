const router = require('express').Router()
const ctrl   = require('../controllers/trainer_pokemon_level_requirements.controller')

router.get('/', ctrl.getAll)
router.get('/for-total/:total', ctrl.getForTotal)
router.get('/estado/:id', ctrl.getEstado)
router.get('/level/:level', ctrl.getByLevel)
router.get('/:id', ctrl.getById)

module.exports = router
