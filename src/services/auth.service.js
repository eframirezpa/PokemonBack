const bcrypt    = require('bcrypt')
const jwt       = require('jsonwebtoken')
const usuariosSvc = require('./usuarios.service')

const JWT_SECRET  = process.env.JWT_SECRET || 'changeme'
const JWT_EXPIRES = process.env.JWT_EXPIRES || '8h'

// Normaliza cualquier ruta de avatar a /avatars/<archivo>.png
const toAvatarUrl = (path) => {
  if (!path) return null
  const filename = String(path).replace(/\\/g, '/').split('/').pop()
  return `/avatars/${filename}`
}

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
  return { token, user: { ...payload, avatar_id: user.avatar_id || null, avatar_face_url: toAvatarUrl(user.avatar_sprite_face) } }
}

module.exports = { login }
