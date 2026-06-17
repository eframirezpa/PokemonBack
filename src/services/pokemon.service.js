const { query, SCHEMA } = require('../config/db')
const T = `"${SCHEMA}"."pokemon"`

const findAll = async ({ limit = 20, offset = 0, search = '', type = '' }) => {
  const params = []
  const conditions = []

  if (search) {
    params.push(`%${search}%`)
    conditions.push(`pokemon_name ILIKE $${params.length}`)
  }
  if (type) {
    params.push(type)
    conditions.push(`(pokemon_type_1 = $${params.length} OR pokemon_type_2 = $${params.length})`)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  params.push(limit, offset)

  const { rows } = await query(
    `SELECT pokemon_id, pokemon_number, pokemon_name, pokemon_type_1, pokemon_type_2,
            pokemon_size, pokemon_sr, pokemon_min_level, pokemon_hit_points,
            pokemon_armor_class, pokemon_media_sprite
     FROM ${T} ${where}
     ORDER BY pokemon_number NULLS LAST, pokemon_id
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )

  const countParams = params.slice(0, -2)
  const { rows: countRows } = await query(
    `SELECT COUNT(*) FROM ${T} ${where}`, countParams
  )

  return { data: rows, total: Number(countRows[0].count) }
}

const findById = async (id) => {
  const { rows } = await query(`SELECT * FROM ${T} WHERE pokemon_id = $1`, [id])
  return rows[0] || null
}

module.exports = { findAll, findById }
