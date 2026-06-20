const bcrypt    = require('bcrypt')
const jwt       = require('jsonwebtoken')
const usuariosSvc = require('./usuarios.service')

const JWT_SECRET  = process.env.JWT_SECRET || 'changeme'
const JWT_EXPIRES = process.env.JWT_EXPIRES || '8h'

const login = async ({ user_name, user_password }) => {
  const user = await usuariosSvc.findByUsername(user_name)
  if (!user) return null

  const match = await bcrypt.compare(user_password, user.user_password)
  if (!match) return null

  const payload = {
    user_id:   user.user_id,
    user_name: user.user_name,
    role:      user.role_name,
  }
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES })
  return { token, user: payload }
}

module.exports = { login }
