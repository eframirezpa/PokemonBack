const svc = require('../services/items.service')

const getAll = async (req, res, next) => {
  try {
    const { limit = 20, offset = 0, search = '', type = '', excludeType = '' } = req.query
    res.json(await svc.findAll({ limit: Number(limit), offset: Number(offset), search, type, excludeType }))
  } catch (e) { next(e) }
}

const getById = async (req, res, next) => {
  try {
    const data = await svc.findById(req.params.id)
    if (!data) return res.status(404).json({ error: 'Item no encontrado' })
    res.json(data)
  } catch (e) { next(e) }
}

const TIPOS_VALIDOS = ['berry', 'pokeball', 'held item', 'evolution', 'trainer gear', 'Event Item', 'medicine', 'Proyectil']

// POST /api/items → crea un item (mochila del máster en la partida)
const create = async (req, res, next) => {
  try {
    const { item_name, item_type, item_cost, item_description } = req.body
    if (!String(item_name || '').trim()) return res.status(400).json({ error: 'El nombre es obligatorio' })
    if (!TIPOS_VALIDOS.includes(item_type)) return res.status(400).json({ error: 'Tipo de item inválido' })
    const cost = Number(item_cost)
    if (item_cost === '' || item_cost == null || !Number.isFinite(cost)) {
      return res.status(400).json({ error: 'El precio debe ser un número' })
    }
    if (!String(item_description || '').trim()) return res.status(400).json({ error: 'La descripción es obligatoria' })

    const created = await svc.create({
      item_name: item_name.trim(), item_type, item_cost: cost, item_description: item_description.trim(),
    })
    res.status(201).json(created)
  } catch (e) {
    // El error de la base (por ejemplo un item_name_id duplicado) se muestra
    // tal cual en el popup, en vez de un 500 genérico.
    res.status(400).json({ error: e.message || 'No se pudo crear el item' })
  }
}

module.exports = { getAll, getById, create }
