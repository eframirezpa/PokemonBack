// Coincidencias entre las especializaciones del entrenador y los tipos de sus Pokémon.
//
// Cada especialización está atada a un tipo (specialization_pokemon_type_name).
// Un Pokémon coincide con ella si ese tipo es alguno de los suyos. Con dos tipos
// y dos especializaciones distintas coincide dos veces, así que el número va de
// 0 a 2.
//
// Se calcula al leer y no se persiste: las especializaciones se ganan en niveles
// posteriores (7 y 18) y los Pokémon entran y salen del equipo, así que cualquier
// número guardado quedaría viejo en silencio.
//
// Vive aparte porque lo usan dos bonos distintos —el STAB de la ruta Type Master
// y el bono a las habilidades— y ambos deben contar exactamente igual.
const { query, SCHEMA } = require('../config/db')

const TPP  = `"${SCHEMA}"."personaje_pokemon"`
const TPT  = `"${SCHEMA}"."pokemon_types"`
const TPSB = `"${SCHEMA}"."personaje_specializations_bonus"`
const TSP  = `"${SCHEMA}"."specializations"`

/**
 * Cuántas especializaciones del entrenador coinciden con cada Pokémon suyo.
 * @returns Map(id_personaje_pokemon → coincidencias). Los que no coinciden no aparecen.
 */
const coincidenciasPorPokemon = async (id_personaje, run = query) => {
  const { rows } = await run(
    `SELECT pp.id_personaje_pokemon AS id,
            COUNT(DISTINCT s.specialization_id)::int AS extra
       FROM ${TPP} pp
       LEFT JOIN ${TPT} t1 ON t1.pokemon_types_id = pp.personaje_pokemon_type_1
       LEFT JOIN ${TPT} t2 ON t2.pokemon_types_id = pp.personaje_pokemon_type_2
       JOIN ${TSP} s ON lower(s.specialization_pokemon_type_name) IN (
              lower(t1.pokemon_types_name), lower(t2.pokemon_types_name))
      WHERE pp.id_personaje = $1
        AND s.specialization_id IN (
              SELECT DISTINCT id_specializations FROM ${TPSB} WHERE id_personaje = $1)
      GROUP BY pp.id_personaje_pokemon`,
    [id_personaje]
  )
  return new Map(rows.map(r => [Number(r.id), Number(r.extra)]))
}

module.exports = { coincidenciasPorPokemon }
