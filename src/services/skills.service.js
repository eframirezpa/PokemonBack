const { query, SCHEMA } = require('../config/db')
const T = `"${SCHEMA}"."skills"`

const findAll = async () => {
  const { rows } = await query(`SELECT * FROM ${T} ORDER BY skill_name`)
  return rows
}

const findById = async (id) => {
  const { rows } = await query(`SELECT * FROM ${T} WHERE skill_id = $1`, [id])
  return rows[0] || null
}

module.exports = { findAll, findById }
