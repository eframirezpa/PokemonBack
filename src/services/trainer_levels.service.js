const { query, SCHEMA } = require('../config/db')
const T = `"${SCHEMA}"."trainer_levels"`

// Catálogo de lo que otorga cada nivel de entrenador (1..20): bono de
// proficiencia, pokéslots, SR máximo y las banderas de qué se gana al llegar.
const findAll = async () => {
  const { rows } = await query(`SELECT * FROM ${T} ORDER BY trainer_level`)
  return rows
}

const findById = async (id) => {
  const { rows } = await query(`SELECT * FROM ${T} WHERE trainer_level_id = $1`, [id])
  return rows[0] || null
}

// Búsqueda por número de nivel (columna única)
const findByLevel = async (level) => {
  const { rows } = await query(`SELECT * FROM ${T} WHERE trainer_level = $1`, [level])
  return rows[0] || null
}

// Todo lo que se gana al pasar de `desde` a `hasta`, un registro por nivel
// atravesado. Sirve para resolver una subida de varios niveles de golpe, que es
// posible porque el nivel se deriva de los niveles de los Pokémon: un solo
// combate puede cruzar más de un umbral.
const findRange = async (desde, hasta) => {
  const { rows } = await query(
    `SELECT * FROM ${T} WHERE trainer_level > $1 AND trainer_level <= $2 ORDER BY trainer_level`,
    [Number(desde) || 0, Number(hasta) || 0]
  )
  return rows
}

module.exports = { findAll, findById, findByLevel, findRange }
