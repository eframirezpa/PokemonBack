const router = require('express').Router()
const ctrl   = require('../controllers/usuarios.controller')
const { authenticate, requireRole } = require('../middleware/auth.middleware')

router.patch('/me/avatar', authenticate, ctrl.updateMyAvatar)

router.get('/',       authenticate, requireRole('master'), ctrl.getAll)
router.get('/:id',    authenticate, requireRole('master'), ctrl.getById)
router.post('/',      authenticate, requireRole('master'), ctrl.create)
router.put('/:id',    authenticate, requireRole('master'), ctrl.update)
router.delete('/:id', authenticate, requireRole('master'), ctrl.remove)

module.exports = router
