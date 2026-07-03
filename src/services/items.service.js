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
    params.push(type)
    conditions.push(`item_type = $${params.length}`)
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

module.exports = { findAll, findById }
