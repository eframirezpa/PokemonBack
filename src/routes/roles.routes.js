const router = require('express').Router()
const ctrl   = require('../controllers/roles.controller')
const { authenticate, requireRole } = require('../middleware/auth.middleware')

router.get('/', authenticate, requireRole('master'), ctrl.getAll)

module.exports = router
