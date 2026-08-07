// Bono de STAB que la ruta del entrenador otorga a sus Pokémon.
//
// REGLA
//   El rasgo 'stab_bonus' de una ruta (hoy: Type Master, nivel 2) no da STAB a
//   todos por igual: da +1 por cada ESPECIALIZACIÓN del entrenador cuyo tipo
//   coincida con alguno de los tipos del Pokémon.
//
//   Un entrenador puede tener varias especializaciones, así que un Pokémon que
//   coincida dos veces -por ejemplo uno Fire/Flying en un entrenador con las
//   especializaciones de Fire y de Flying- gana +2.
//
// Se calcula al leer y no se persiste en personaje_pokemon: las
// especializaciones se ganan en niveles posteriores (7 y 18), así que el bono
// cambia con el tiempo y también alcanza a los Pokémon que lleguen después.
// Persistir el número lo dejaría desactualizado en silencio.
const { query, SCHEMA } = require('../config/db')

const TPP  = `"${SCHEMA}"."personaje_pokemon"`
const TPT  = `"${SCHEMA}"."pokemon_types"`
const TPSB = `"${SCHEMA}"."personaje_specializations_bonus"`
const TSP  = `"${SCHEMA}"."specializations"`
const TPPB = `"${SCHEMA}"."personaje_path_bonus"`

/** ¿La ruta del entrenador le dio el rasgo de STAB? */
const tieneBonoStab = async (id_personaje, run = query) => {
  const { rows } = await run(
    `SELECT 1 FROM ${TPPB}
      WHERE personaje_path_bonus_personaje_id = $1
        AND lower(personaje_path_bonus_type) = 'stab_bonus'
      LIMIT 1`, [id_personaje])
  return rows.length > 0
}

/**
 * STAB extra por Pokémon del entrenador.
 * @returns Map(id_personaje_pokemon → extra). Vacío si no tiene el rasgo.
 */
const stabExtraDelPersonaje = async (id_personaje, run = query) => {
  if (!(await tieneBonoStab(id_personaje, run))) return new Map()

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

/**
 * Vista previa para la ventana de subida de nivel: qué Pokémon ganarían cuánto.
 * Se calcula ANTES de persistir el bono, así que no consulta personaje_path_bonus.
 */
const previewStab = async (id_personaje, run = query) => {
  const { rows } = await run(
    `SELECT pp.id_personaje_pokemon AS id,
            pp.pokemon_apodo        AS apodo,
            pk.pokemon_name         AS especie,
            t1.pokemon_types_name   AS tipo_1,
            t2.pokemon_types_name   AS tipo_2,
            COUNT(DISTINCT s.specialization_id)::int AS extra
       FROM ${TPP} pp
       JOIN "${SCHEMA}"."pokemon" pk ON pk.pokemon_id = pp.id_pokemon
       LEFT JOIN ${TPT} t1 ON t1.pokemon_types_id = pp.personaje_pokemon_type_1
       LEFT JOIN ${TPT} t2 ON t2.pokemon_types_id = pp.personaje_pokemon_type_2
       JOIN ${TSP} s ON lower(s.specialization_pokemon_type_name) IN (
              lower(t1.pokemon_types_name), lower(t2.pokemon_types_name))
      WHERE pp.id_personaje = $1
        AND s.specialization_id IN (
              SELECT DISTINCT id_specializations FROM ${TPSB} WHERE id_personaje = $1)
      GROUP BY pp.id_personaje_pokemon, pp.pokemon_apodo, pk.pokemon_name,
               t1.pokemon_types_name, t2.pokemon_types_name
      ORDER BY extra DESC, pp.pokemon_apodo`,
    [id_personaje]
  )
  return rows
}

module.exports = { tieneBonoStab, stabExtraDelPersonaje, previewStab }
