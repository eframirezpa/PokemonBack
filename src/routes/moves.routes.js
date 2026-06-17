const router = require('express').Router()
const ctrl   = require('../controllers/moves.controller')

// GET /api/moves?limit=20&offset=0&search=flamethrower&type=FIRE
router.get('/', ctrl.getAll)
router.get('/:id', ctrl.getById)

module.exports = router
