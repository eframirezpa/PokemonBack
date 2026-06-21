const { query, SCHEMA } = require('../config/db')
const T = `"${SCHEMA}"."avatar"`

const findAll = async () => {
  const { rows } = await query(`SELECT * FROM ${T} ORDER BY avatar_id`)
  return rows
}

const findById = async (id) => {
  const { rows } = await query(`SELECT * FROM ${T} WHERE avatar_id = $1`, [id])
  return rows[0] || null
}

module.exports = { findAll, findById }
