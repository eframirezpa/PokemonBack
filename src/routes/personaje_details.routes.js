const router = require('express').Router()
const ctrl   = require('../controllers/personaje_details.controller')
const { authenticate } = require('../middleware/auth.middleware')

router.get('/',       authenticate, ctrl.getAll)
router.get('/:id',    authenticate, ctrl.getById)
router.post('/',      authenticate, ctrl.create)
router.put('/:id',    authenticate, ctrl.update)
router.delete('/:id', authenticate, ctrl.remove)

module.exports = router
