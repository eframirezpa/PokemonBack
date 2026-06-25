const router = require('express').Router()
const ctrl   = require('../controllers/skills.controller')

router.get('/',    ctrl.getAll)
router.get('/:id', ctrl.getById)

module.exports = router
