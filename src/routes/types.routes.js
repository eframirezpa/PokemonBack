const router = require('express').Router()
const ctrl   = require('../controllers/types.controller')

// GET /api/types
router.get('/', ctrl.getTypes)

// GET /api/types/effectiveness?attacking=FIRE&defending=WATER
router.get('/effectiveness', ctrl.getEffectiveness)

module.exports = router
