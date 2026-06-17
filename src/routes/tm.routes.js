const router = require('express').Router()
const ctrl   = require('../controllers/tm.controller')

// GET /api/tm?search=fireball
router.get('/', ctrl.getAll)
router.get('/:id', ctrl.getById)

module.exports = router
