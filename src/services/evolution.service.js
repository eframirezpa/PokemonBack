const { query, SCHEMA } = require('../config/db')
const T  = `"${SCHEMA}"."evolution"`
const TP = `"${SCHEMA}"."pokemon"`

const findAll = async ({ limit = 20, offset = 0 }) => {
  const { rows } = await query(
    `SELECT e.*,
            pf.pokemon_name AS from_name,
            pt.pokemon_name AS to_name
     FROM ${T} e
     LEFT JOIN ${TP} pf ON e.evolution_from_pokemon_id = pf.pokemon_id
     LEFT JOIN ${TP} pt ON e.evolution_to_pokemon_id   = pt.pokemon_id
     ORDER BY e.evolution_id
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  )
  const { rows: c } = await query(`SELECT COUNT(*) FROM ${T}`)
  return { data: rows, total: Number(c[0].count) }
}

const findByPokemonId = async (pokemonId) => {
  const { rows } = await query(
    `SELECT e.*,
            pf.pokemon_name AS from_name, pf.pokemon_media_sprite AS from_sprite,
            pt.pokemon_name AS to_name,   pt.pokemon_media_sprite AS to_sprite
     FROM ${T} e
     LEFT JOIN ${TP} pf ON e.evolution_from_pokemon_id = pf.pokemon_id
     LEFT JOIN ${TP} pt ON e.evolution_to_pokemon_id   = pt.pokemon_id
     WHERE e.evolution_from_pokemon_id = $1 OR e.evolution_to_pokemon_id = $1
     ORDER BY e.evolution_id`,
    [pokemonId]
  )
  return rows
}

module.exports = { findAll, findByPokemonId }
