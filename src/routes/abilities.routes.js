const router = require('express').Router()
const ctrl   = require('../controllers/abilities.controller')

// GET /api/abilities?search=blaze
router.get('/', ctrl.getAll)
router.get('/:id', ctrl.getById)

module.exports = router
