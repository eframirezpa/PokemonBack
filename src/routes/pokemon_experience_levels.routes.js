const router = require('express').Router()
const ctrl   = require('../controllers/pokemon_experience_levels.controller')

router.get('/', ctrl.getAll)
router.get('/level/:level', ctrl.getByLevel)
router.get('/:id', ctrl.getById)

module.exports = router
