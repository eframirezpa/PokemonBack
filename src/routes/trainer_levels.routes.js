const router = require('express').Router()
const ctrl   = require('../controllers/trainer_levels.controller')

router.get('/', ctrl.getAll)
router.get('/range', ctrl.getRange)          // antes de /:id, si no lo captura
router.get('/level/:level', ctrl.getByLevel)
router.get('/:id', ctrl.getById)

module.exports = router
