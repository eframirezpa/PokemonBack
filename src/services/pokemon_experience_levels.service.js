const { query, SCHEMA } = require('../config/db')
const T = `"${SCHEMA}"."pokemon_experience_levels"`

const findAll = async () => {
  const { rows } = await query(`SELECT * FROM ${T} ORDER BY pokemon_level`)
  return rows
}

const findById = async (id) => {
  const { rows } = await query(`SELECT * FROM ${T} WHERE pokemon_experience_level_id = $1`, [id])
  return rows[0] || null
}

// Búsqueda por número de nivel (columna única)
const findByLevel = async (level) => {
  const { rows } = await query(`SELECT * FROM ${T} WHERE pokemon_level = $1`, [level])
  return rows[0] || null
}

module.exports = { findAll, findById, findByLevel }
