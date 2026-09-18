const router = require('express').Router()
const ctrl   = require('../controllers/items.controller')
const { authenticate, requireRole } = require('../middleware/auth.middleware')

// GET /api/items?search=potion&type=Medicine
router.get('/', ctrl.getAll)
router.get('/:id', ctrl.getById)
// POST /api/items → crea un item nuevo (solo el máster, desde la mochila de la partida)
router.post('/', authenticate, requireRole('master'), ctrl.create)
// PATCH /api/items/:id → el máster corrige nombre, precio, tipo o descripción
router.patch('/:id', authenticate, requireRole('master'), ctrl.update)
// DELETE /api/items/:id → el máster borra un item del catálogo (si no está en uso)
router.delete('/:id', authenticate, requireRole('master'), ctrl.remove)

module.exports = router
