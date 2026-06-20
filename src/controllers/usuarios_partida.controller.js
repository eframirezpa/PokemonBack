const svc = require('../services/usuarios_partida.service')

const getByPartida = async (req, res, next) => {
  try {
    res.json(await svc.findByPartida(req.params.id))
  } catch (e) { next(e) }
}

const getAvailable = async (req, res, next) => {
  try {
    res.json(await svc.findAvailable(req.params.id))
  } catch (e) { next(e) }
}

const add = async (req, res, next) => {
  try {
    const { user_id } = req.body
    if (!user_id) return res.status(400).json({ error: 'user_id es requerido' })
    const data = await svc.add(req.params.id, user_id)
    if (!data) return res.status(409).json({ error: 'El usuario ya pertenece a esta partida' })
    res.status(201).json(data)
  } catch (e) { next(e) }
}

const remove = async (req, res, next) => {
  try {
    const ok = await svc.remove(req.params.id, req.params.userId)
    if (!ok) return res.status(404).json({ error: 'Relación no encontrada' })
    res.status(204).send()
  } catch (e) { next(e) }
}

module.exports = { getByPartida, getAvailable, add, remove }
