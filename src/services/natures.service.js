const { query, SCHEMA } = require('../config/db')
const T = `"${SCHEMA}"."natures"`

const findAll = async ({ limit = 100, offset = 0, search = '' }) => {
  const params = []
  const where = search
    ? (params.push(`%${search}%`), `WHERE nature_name ILIKE $1`)
    : ''
  params.push(limit, offset)

  const { rows } = await query(
    `SELECT * FROM ${T} ${where}
     ORDER BY nature_name
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )
  const { rows: c } = await query(
    `SELECT COUNT(*) FROM ${T} ${where}`, search ? [`%${search}%`] : []
  )
  return { data: rows, total: Number(c[0].count) }
}

const findById = async (id) => {
  const { rows } = await query(`SELECT * FROM ${T} WHERE nature_id = $1`, [id])
  return rows[0] || null
}

module.exports = { findAll, findById }
