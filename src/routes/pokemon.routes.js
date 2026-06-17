const router = require('express').Router()
const ctrl   = require('../controllers/pokemon.controller')

// GET /api/pokemon?limit=20&offset=0&search=char&type=FIRE
router.get('/', ctrl.getAll)

// GET /api/pokemon/:id
router.get('/:id', ctrl.getById)

module.exports = router
