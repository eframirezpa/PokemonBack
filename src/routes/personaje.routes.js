const router = require('express').Router()
const ctrl   = require('../controllers/personaje.controller')
const { authenticate } = require('../middleware/auth.middleware')

router.get('/',         authenticate, ctrl.getMine)
router.get('/:id/full', authenticate, ctrl.getFull)
router.get('/:id',      authenticate, ctrl.getById)
router.post('/',        authenticate, ctrl.create)

module.exports = router
