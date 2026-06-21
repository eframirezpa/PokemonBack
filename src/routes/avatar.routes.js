const router = require('express').Router()
const ctrl   = require('../controllers/avatar.controller')

router.get('/', ctrl.getAll)

module.exports = router
