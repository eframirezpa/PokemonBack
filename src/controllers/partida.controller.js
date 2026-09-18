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

// GET /api/partida/:id/mapa-pin → dónde está la party (lo lee cualquiera en la partida)
const getMapaPin = async (req, res, next) => {
  try {
    const r = await svc.findMapaPin(req.params.id)
    if (r.error) return res.status(404).json({ error: 'Partida no encontrada' })
    res.json({ pin: r.pin })
  } catch (e) { next(e) }
}

// PATCH /api/partida/:id/mapa-pin → fija, mueve o quita el pin (solo el máster dueño)
// Body: { pin: { x, y, label?, mapa? } } o { pin: null } para quitarlo.
const setMapaPin = async (req, res, next) => {
  try {
    const { pin } = req.body
    if (pin) {
      const x = Number(pin.x), y = Number(pin.y)
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 100 || y < 0 || y > 100) {
        return res.status(400).json({ error: 'Coordenadas fuera del mapa' })
      }
    }
    const r = await svc.setMapaPin(req.params.id, req.user.user_id, pin)
    if (r.error) return res.status(404).json({ error: 'Partida no encontrada' })
    res.json({ pin: r.pin })
  } catch (e) { next(e) }
}

// ── Iniciativa ──
// GET: lo lee cualquiera de la mesa. Escribir tiene dos puertas: el máster
// maneja la ronda entera, y cada jugador solo puede apuntar SU tirada.

const getIniciativa = async (req, res, next) => {
  try {
    const r = await svc.findIniciativa(req.params.id)
    if (r.error) return res.status(404).json({ error: 'Partida no encontrada' })
    res.json({ iniciativa: r.iniciativa })
  } catch (e) { next(e) }
}

// POST /api/partida/:id/iniciativa  { participantes } → abre la ronda (máster)
const abrirIniciativa = async (req, res, next) => {
  try {
    const participantes = Array.isArray(req.body?.participantes) ? req.body.participantes : []
    if (!participantes.length) return res.status(400).json({ error: 'No hay a quién pedirle iniciativa' })
    const r = await svc.abrirIniciativa(req.params.id, req.user.user_id, participantes)
    if (r.error) return res.status(404).json({ error: 'Partida no encontrada' })
    res.json({ iniciativa: r.iniciativa })
  } catch (e) { next(e) }
}

// PUT /api/partida/:id/iniciativa  { iniciativa } → turno, ronda o cerrar (máster)
const setIniciativa = async (req, res, next) => {
  try {
    const r = await svc.guardarIniciativa(req.params.id, req.body?.iniciativa ?? null, req.user.user_id)
    if (r.error) return res.status(404).json({ error: 'Partida no encontrada' })
    res.json({ iniciativa: r.iniciativa })
  } catch (e) { next(e) }
}

// PATCH /api/partida/:id/iniciativa/tirada  { d20, mod } → la tirada propia
const tirarIniciativa = async (req, res, next) => {
  try {
    const d20 = Number(req.body?.d20)
    if (!Number.isInteger(d20) || d20 < 1 || d20 > 20) {
      return res.status(400).json({ error: 'El dado debe ser un número entre 1 y 20' })
    }
    // La clave se arma con el id de quien pide, no con lo que mande el cliente:
    // así nadie puede tirar por otro.
    const r = await svc.tirarIniciativa(req.params.id, `u${req.user.user_id}`, d20, req.body?.mod,
                                        req.user.user_id, req.body?.personaje_id ?? null)
    if (r.error === 'notfound')   return res.status(404).json({ error: 'Partida no encontrada' })
    if (r.error === 'sinronda')   return res.status(409).json({ error: 'No hay una tirada de iniciativa abierta' })
    if (r.error === 'noparticipa') return res.status(403).json({ error: 'No estás en esta ronda' })
    res.json({ iniciativa: r.iniciativa })
  } catch (e) { next(e) }
}

// PATCH /api/partida/:id/iniciativa/turno  { direccion } → pasa el turno
const avanzarTurno = async (req, res, next) => {
  try {
    const esMaster = req.user.role === 'master'
    const r = await svc.avanzarTurno(req.params.id, req.user.user_id, esMaster, req.body?.direccion)
    if (r.error === 'notfound')  return res.status(404).json({ error: 'Partida no encontrada' })
    if (r.error === 'sinronda')  return res.status(409).json({ error: 'No hay un combate en curso' })
    if (r.error === 'noesturno') return res.status(403).json({ error: 'No es tu turno' })
    res.json({ iniciativa: r.iniciativa })
  } catch (e) { next(e) }
}

module.exports = { avanzarTurno, getMisPartidas, getByOwner, getById, create, update, toggleActivada, getMapaPin, setMapaPin, getIniciativa, abrirIniciativa, setIniciativa, tirarIniciativa }
