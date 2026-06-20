const path    = require('path')
const svc     = require('../services/partida.service')
const storage = require('../services/storage.service')

const getMisPartidas = async (req, res, next) => {
  try {
    res.json(await svc.findActiveByUser(req.user.user_id))
  } catch (e) { next(e) }
}

const getByOwner = async (req, res, next) => {
  try {
    res.json(await svc.findByOwner(req.user.user_id))
  } catch (e) { next(e) }
}

const getById = async (req, res, next) => {
  try {
    const data = await svc.findById(req.params.id)
    if (!data) return res.status(404).json({ error: 'Partida no encontrada' })
    res.json(data)
  } catch (e) { next(e) }
}

const create = async (req, res, next) => {
  try {
    const { nombre, descripcion, titulo1, leyenda1, titulo2, leyenda2, titulo3, leyenda3 } = req.body

    const partida = await svc.create({
      nombre, descripcion, titulo1, leyenda1, titulo2, leyenda2, titulo3, leyenda3,
      owner_id: req.user.user_id,
    })

    const id      = partida.id_partida
    const sprites = {}

    for (const key of ['sprite1', 'sprite2', 'sprite3']) {
      const file = req.files?.[key]?.[0]
      if (file) {
        const ext        = path.extname(file.originalname) || '.jpg'
        const remotePath = `partida/${id}/${key}${ext}`
        sprites[key]     = await storage.uploadSprite(file.buffer, remotePath, file.mimetype)
      }
    }

    const updated = await svc.updateSprites(id, {
      sprite1: sprites.sprite1 || null,
      sprite2: sprites.sprite2 || null,
      sprite3: sprites.sprite3 || null,
    })

    res.status(201).json(updated)
  } catch (e) { next(e) }
}

const update = async (req, res, next) => {
  try {
    const { nombre, descripcion, titulo1, leyenda1, titulo2, leyenda2, titulo3, leyenda3 } = req.body
    const id = req.params.id

    let partida = await svc.update(id, { nombre, descripcion, titulo1, leyenda1, titulo2, leyenda2, titulo3, leyenda3 })
    if (!partida) return res.status(404).json({ error: 'Partida no encontrada' })

    if (req.files && Object.keys(req.files).length > 0) {
      const sprites = {
        sprite1: partida.sprite1_partida,
        sprite2: partida.sprite2_partida,
        sprite3: partida.sprite3_partida,
      }

      for (const key of ['sprite1', 'sprite2', 'sprite3']) {
        const file = req.files?.[key]?.[0]
        if (file) {
          const ext        = path.extname(file.originalname) || '.jpg'
          const remotePath = `partida/${id}/${key}${ext}`
          sprites[key]     = await storage.uploadSprite(file.buffer, remotePath, file.mimetype)
        }
      }

      partida = await svc.updateSprites(id, sprites)
    }

    res.json(partida)
  } catch (e) { next(e) }
}

const toggleActivada = async (req, res, next) => {
  try {
    const data = await svc.toggleActivada(req.params.id)
    if (!data) return res.status(404).json({ error: 'Partida no encontrada' })
    res.json(data)
  } catch (e) { next(e) }
}

module.exports = { getMisPartidas, getByOwner, getById, create, update, toggleActivada }
