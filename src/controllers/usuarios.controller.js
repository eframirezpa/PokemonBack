const svc = require('../services/usuarios.service')

const getAll = async (_req, res, next) => {
  try {
    res.json(await svc.findAll())
  } catch (e) { next(e) }
}

const getById = async (req, res, next) => {
  try {
    const data = await svc.findById(req.params.id)
    if (!data) return res.status(404).json({ error: 'Usuario no encontrado' })
    res.json(data)
  } catch (e) { next(e) }
}

const create = async (req, res, next) => {
  try {
    const { user_name, user_password, role_id } = req.body
    if (!user_name || !user_password || !role_id) {
      return res.status(400).json({ error: 'user_name, user_password y role_id son requeridos' })
    }
    const data = await svc.create({ user_name, user_password, role_id })
    res.status(201).json(data)
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'El nombre de usuario ya existe' })
    next(e)
  }
}

const update = async (req, res, next) => {
  try {
    const data = await svc.update(req.params.id, req.body)
    if (!data) return res.status(404).json({ error: 'Usuario no encontrado' })
    res.json(data)
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'El nombre de usuario ya existe' })
    next(e)
  }
}

const remove = async (req, res, next) => {
  try {
    const ok = await svc.remove(req.params.id)
    if (!ok) return res.status(404).json({ error: 'Usuario no encontrado' })
    res.status(204).send()
  } catch (e) { next(e) }
}

const updateMyAvatar = async (req, res, next) => {
  try {
    const { avatar_id } = req.body
    const data = await svc.update(req.user.user_id, { avatar_id })
    if (!data) return res.status(404).json({ error: 'Usuario no encontrado' })
    res.json(data)
  } catch (e) { next(e) }
}

module.exports = { getAll, getById, create, update, remove, updateMyAvatar }
