const { query, SCHEMA } = require('../config/db')
const T = `"${SCHEMA}"."roles"`

const findAll = async () => {
  const { rows } = await query(`SELECT * FROM ${T} ORDER BY role_id`)
  return rows
}

module.exports = { findAll }
