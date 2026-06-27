const router = require('express').Router()
const ctrl   = require('../controllers/personaje.controller')
const { authenticate } = require('../middleware/auth.middleware')

router.get('/',                    authenticate, ctrl.getMine)
router.get('/:id/full',            authenticate, ctrl.getFull)
router.get('/:id/equipo',          authenticate, ctrl.getEquipo)
router.post('/:id/equipo',         authenticate, ctrl.addEquipo)
router.patch('/:id/equipo/:idEquipo', authenticate, ctrl.updateEquipo)
router.get('/:id/armor',           authenticate, ctrl.getArmor)
router.post('/:id/armor',          authenticate, ctrl.addArmor)
router.patch('/:id/armor/:idArmor', authenticate, ctrl.updateArmorInUse)
router.get('/:id/weapon',          authenticate, ctrl.getWeapon)
router.post('/:id/weapon',         authenticate, ctrl.addWeapon)
router.patch('/:id/weapon/:idWeapon', authenticate, ctrl.updateWeaponInUse)
router.get('/:id',                 authenticate, ctrl.getById)
router.post('/',                   authenticate, ctrl.create)

module.exports = router
