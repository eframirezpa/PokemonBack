const router = require('express').Router()
const ctrl   = require('../controllers/weapon_properties.controller')

router.get('/', ctrl.getAll)
router.get('/:id', ctrl.getById)

module.exports = router
