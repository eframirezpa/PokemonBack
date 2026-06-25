const router = require('express').Router()
const ctrl   = require('../controllers/feats_bonus.controller')

router.get('/',            ctrl.getAll)
router.get('/feat/:featId', ctrl.getByFeat)
router.get('/:id',         ctrl.getById)
router.post('/',           ctrl.create)
router.put('/:id',         ctrl.update)
router.delete('/:id',      ctrl.remove)

module.exports = router
