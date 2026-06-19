const { query, SCHEMA } = require('../config/db')
const T = `"${SCHEMA}"."bonds"`

const findAll = async ({ limit = 100, offset = 0 }) => {
  const params = [limit, offset]
  const { rows } = await query(
    `SELECT * FROM ${T} ORDER BY bond_level LIMIT $1 OFFSET $2`, params
  )
  const { rows: c } = await query(`SELECT COUNT(*) FROM ${T}`)
  return { data: rows, total: Number(c[0].count) }
}

const findById = async (id) => {
  const { rows } = await query(`SELECT * FROM ${T} WHERE bond_id = $1`, [id])
  return rows[0] || null
}

module.exports = { findAll, findById }
