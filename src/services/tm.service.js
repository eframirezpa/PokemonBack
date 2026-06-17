const { query, SCHEMA } = require('../config/db')
const T = `"${SCHEMA}"."TM"`

const findAll = async ({ limit = 20, offset = 0, search = '' }) => {
  const params = []
  const where = search
    ? (params.push(`%${search}%`), `WHERE tm_name ILIKE $1`)
    : ''
  params.push(limit, offset)

  const { rows } = await query(
    `SELECT tm_id, tm_number, tm_name_id, tm_name, tm_cost, tm_notes
     FROM ${T} ${where}
     ORDER BY tm_number
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )
  const { rows: c } = await query(
    `SELECT COUNT(*) FROM ${T} ${where}`, search ? [`%${search}%`] : []
  )
  return { data: rows, total: Number(c[0].count) }
}

const findById = async (id) => {
  const { rows } = await query(`SELECT * FROM ${T} WHERE tm_id = $1`, [id])
  return rows[0] || null
}

module.exports = { findAll, findById }
