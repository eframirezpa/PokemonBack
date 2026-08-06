const router = require('express').Router()
const ctrl   = require('../controllers/paths.controller')

router.get('/', ctrl.getAll)
router.get('/name/:nameId', ctrl.getByNameId)
router.get('/:id/bonus/:level', ctrl.getBonusUpToLevel)
router.get('/:id', ctrl.getById)

module.exports = router
