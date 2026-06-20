const router  = require('express').Router()
const multer  = require('multer')
const ctrl    = require('../controllers/partida.controller')
const upCtrl  = require('../controllers/usuarios_partida.controller')
const { authenticate, requireRole } = require('../middleware/auth.middleware')

const upload = multer({ storage: multer.memoryStorage() })
const sprites = upload.fields([
  { name: 'sprite1', maxCount: 1 },
  { name: 'sprite2', maxCount: 1 },
  { name: 'sprite3', maxCount: 1 },
])

// Accesible para cualquier usuario autenticado
router.get('/mis-partidas', authenticate, ctrl.getMisPartidas)

// Solo master
const master = [authenticate, requireRole('master')]
router.get('/',                        ...master, ctrl.getByOwner)
router.get('/:id',                     ...master, ctrl.getById)
router.post('/',          sprites,     ...master, ctrl.create)
router.put('/:id',        sprites,     ...master, ctrl.update)
router.patch('/:id/toggle',            ...master, ctrl.toggleActivada)

router.get('/:id/usuarios',            ...master, upCtrl.getByPartida)
router.get('/:id/usuarios/available',  ...master, upCtrl.getAvailable)
router.post('/:id/usuarios',           ...master, upCtrl.add)
router.delete('/:id/usuarios/:userId', ...master, upCtrl.remove)

module.exports = router
