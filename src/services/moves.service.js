const { query, SCHEMA } = require('../config/db')
const T = `"${SCHEMA}"."moves"`

const findAll = async ({ limit = 20, offset = 0, search = '', type = '' }) => {
  const params = []
  const conditions = []

  if (search) {
    params.push(`%${search}%`)
    conditions.push(`moves_move_name ILIKE $${params.length}`)
  }
  if (type) {
    params.push(type)
    conditions.push(`moves_move_type = $${params.length}`)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  params.push(limit, offset)

  const { rows } = await query(
    `SELECT move_id, moves_move_name, moves_move_type, moves_move_power_1,
            moves_move_pp, moves_move_time, moves_move_range, moves_move_has_damage
     FROM ${T} ${where}
     ORDER BY moves_move_name
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )

  const { rows: countRows } = await query(
    `SELECT COUNT(*) FROM ${T} ${where}`, params.slice(0, -2)
  )

  return { data: rows, total: Number(countRows[0].count) }
}

const findById = async (id) => {
  const { rows } = await query(`SELECT * FROM ${T} WHERE move_id = $1`, [id])
  return rows[0] || null
}

module.exports = { findAll, findById }
