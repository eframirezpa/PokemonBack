const svc = require('../services/auth.service')

const login = async (req, res, next) => {
  try {
    const { user_name, user_password } = req.body
    if (!user_name || !user_password) {
      return res.status(400).json({ error: 'user_name y user_password son requeridos' })
    }
    const result = await svc.login({ user_name, user_password })
    if (!result) return res.status(401).json({ error: 'Credenciales incorrectas' })
    res.json(result)
  } catch (e) { next(e) }
}

module.exports = { login }
