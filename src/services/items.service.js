const { query, SCHEMA } = require('../config/db')
const T = `"${SCHEMA}"."items"`

const findAll = async ({ limit = 20, offset = 0, search = '', type = '', excludeType = '' }) => {
  const params = []
  const conditions = []

  if (search) {
    params.push(`%${search}%`)
    conditions.push(`item_name ILIKE $${params.length}`)
  }
  if (type) {
    // "held item,berry" → cualquiera de los dos. Sigue aceptando un solo
    // valor tal cual, así que no rompe a nadie que ya llame con uno solo.
    const tipos = type.split(',').map(t => t.trim()).filter(Boolean)
    params.push(tipos)
    conditions.push(`item_type = ANY($${params.length})`)
  }
  if (excludeType) {
    params.push(excludeType)
    conditions.push(`item_type <> $${params.length}`)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  params.push(limit, offset)

  const { rows } = await query(
    `SELECT item_id, item_name, item_type, item_cost, item_description, item_media_sprite
     FROM ${T} ${where}
     ORDER BY item_name
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )
  const { rows: c } = await query(
    `SELECT COUNT(*) FROM ${T} ${where}`, params.slice(0, -2)
  )
  return { data: rows, total: Number(c[0].count) }
}

const findById = async (id) => {
  const { rows } = await query(`SELECT * FROM ${T} WHERE item_id = $1`, [id])
  return rows[0] || null
}

/**
 * Crea un item nuevo (lo usa el máster desde la mochila de la partida).
 *
 * item_id no sale de la secuencia de la tabla: quedó desincronizada de los
 * ids reales hace tiempo (bulk-load con ids explícitos), así que el máximo
 * actual se calcula en el mismo INSERT, no antes -así no hay hueco entre
 * "calcular" y "guardar" donde otro item se cuele con el mismo id-.
 */
const create = async ({ item_name, item_type, item_cost, item_description }) => {
  const item_name_id = item_name.trim().toLowerCase().replace(/\s+/g, '-')
  const { rows } = await query(
    `INSERT INTO ${T} (
       item_id, item_name_id, item_name, item_type, item_cost,
       item_description, item_media_sprite, item_notes, item_last_updated
     )
     SELECT COALESCE(MAX(item_id), 0) + 1, $1, $2, $3, $4, $5, NULL, NULL, now()::text
       FROM ${T}
     RETURNING *`,
    [item_name_id, item_name, item_type, item_cost, item_description]
  )
  return rows[0]
}

module.exports = { findAll, findById, create }
