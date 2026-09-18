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
// El pin del mapa lo LEEN todos los de la partida (jugadores y espectadores),
// por eso vive aquí arriba y no en el bloque master; escribirlo sí es cosa del
// máster y va más abajo.
router.get('/:id/mapa-pin', authenticate, ctrl.getMapaPin)
// La iniciativa la lee toda la mesa, y cada quien apunta SU tirada (el
// controlador arma la clave con su propio id, nadie tira por otro).
router.get('/:id/iniciativa',            authenticate, ctrl.getIniciativa)
router.patch('/:id/iniciativa/tirada',   authenticate, ctrl.tirarIniciativa)
// Pasar turno: el máster siempre; el dueño del turno, solo hacia adelante
router.patch('/:id/iniciativa/turno',    authenticate, ctrl.avanzarTurno)
// Intercambio de Alert / Alert Pokemon: cualquiera de los dos lados lo puede
// llamar, la validación de quién tiene el feat vive en el service.
router.patch('/:id/iniciativa/intercambio', authenticate, ctrl.intercambiarIniciativa)

// Solo master
const master = [authenticate, requireRole('master')]
router.get('/',                        ...master, ctrl.getByOwner)
router.get('/:id',                     ...master, ctrl.getById)
router.post('/',          sprites,     ...master, ctrl.create)
router.put('/:id',        sprites,     ...master, ctrl.update)
router.patch('/:id/toggle',            ...master, ctrl.toggleActivada)
router.patch('/:id/mapa-pin',          ...master, ctrl.setMapaPin)
router.post('/:id/iniciativa',         ...master, ctrl.abrirIniciativa)
router.put('/:id/iniciativa',          ...master, ctrl.setIniciativa)

router.get('/:id/usuarios',            ...master, upCtrl.getByPartida)
router.get('/:id/usuarios/available',  ...master, upCtrl.getAvailable)
router.post('/:id/usuarios',           ...master, upCtrl.add)
router.delete('/:id/usuarios/:userId', ...master, upCtrl.remove)

module.exports = router
