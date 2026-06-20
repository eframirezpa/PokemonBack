const router = require('express').Router()
const ctrl   = require('../controllers/auth.controller')
const { authenticate } = require('../middleware/auth.middleware')

router.post('/login', ctrl.login)

router.get('/me', authenticate, (req, res) => {
  res.json(req.user)
})

module.exports = router
