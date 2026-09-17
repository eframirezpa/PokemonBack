const router = require('express').Router()
const ctrl   = require('../controllers/master_npc.controller')
const { authenticate } = require('../middleware/auth.middleware')

// La pertenencia se comprueba en cada consulta con el id del máster, como en
// master_pokemon: un NPC ajeno no aparece ni se deja tocar.
router.get('/',                 authenticate, ctrl.getAll)
// Antes de '/:idnpc', que si no se tragaría la palabra 'sugerencia' como un id
router.get('/sugerencia',       authenticate, ctrl.getSugerencia)
router.get('/:idnpc',           authenticate, ctrl.getById)
router.post('/',                authenticate, ctrl.create)
router.patch('/:idnpc',         authenticate, ctrl.update)
router.patch('/:idnpc/combate', authenticate, ctrl.updateCombate)
router.delete('/:idnpc',        authenticate, ctrl.remove)

module.exports = router
