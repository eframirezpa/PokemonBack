const { query, SCHEMA } = require('../config/db')
const TT = `"${SCHEMA}"."pokemon_types"`
const TE = `"${SCHEMA}"."type_effectiveness"`

const findAllTypes = async () => {
  const { rows } = await query(`SELECT * FROM ${TT} ORDER BY pokemon_types_name`)
  return rows
}

const findEffectiveness = async ({ attackingType = '', defendingType = '' }) => {
  const params = []
  const conditions = []

  if (attackingType) {
    params.push(attackingType)
    conditions.push(`type_effectiveness_attacking_type = $${params.length}`)
  }
  if (defendingType) {
    params.push(defendingType)
    conditions.push(`type_effectiveness_defending_type = $${params.length}`)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const { rows } = await query(
    `SELECT * FROM ${TE} ${where} ORDER BY type_effectiveness_attacking_type`,
    params
  )
  return rows
}

module.exports = { findAllTypes, findEffectiveness }
