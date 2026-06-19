const router = require('express').Router()
const ctrl   = require('../controllers/backgrounds.controller')

router.get('/', ctrl.getAll)
router.get('/:id', ctrl.getById)

module.exports = router
