const { query, SCHEMA } = require('../config/db')
const T = `"${SCHEMA}"."abilities"`

const findAll = async ({ limit = 20, offset = 0, search = '' }) => {
  const params = []
  const where = search
    ? (params.push(`%${search}%`), `WHERE ability_name ILIKE $1`)
    : ''
  params.push(limit, offset)

  const { rows } = await query(
    `SELECT ability_id, ability_name, ability_description, ability_is_deprecated
     FROM ${T} ${where}
     ORDER BY ability_name
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )
  const { rows: c } = await query(
    `SELECT COUNT(*) FROM ${T} ${where}`, search ? [`%${search}%`] : []
  )
  return { data: rows, total: Number(c[0].count) }
}

const findById = async (id) => {
  const { rows } = await query(`SELECT * FROM ${T} WHERE ability_id = $1`, [id])
  return rows[0] || null
}

module.exports = { findAll, findById }
