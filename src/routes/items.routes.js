const router = require('express').Router()
const ctrl   = require('../controllers/items.controller')

// GET /api/items?search=potion&type=Medicine
router.get('/', ctrl.getAll)
router.get('/:id', ctrl.getById)

module.exports = router
