const { query, SCHEMA } = require('../config/db')
const tl = require('./trainer_level.service')
const T   = `"${SCHEMA}"."trainer_pokemon_level_requirements"`
const TP  = `"${SCHEMA}"."personaje"`

// Umbrales de niveles de Pokémon acumulados que hacen subir al entrenador.
// La tabla arranca en el nivel 2: el 1 no tiene requisito.
const findAll = async () => {
  const { rows } = await query(`SELECT * FROM ${T} ORDER BY trainer_level`)
  return rows
}

const findById = async (id) => {
  const { rows } = await query(
    `SELECT * FROM ${T} WHERE trainer_pokemon_level_requirement_id = $1`, [id])
  return rows[0] || null
}

const findByLevel = async (level) => {
  const { rows } = await query(`SELECT * FROM ${T} WHERE trainer_level = $1`, [level])
  return rows[0] || null
}

// Nivel de entrenador que corresponde a un total de niveles de Pokémon.
// Es el mayor nivel cuyo umbral ya se alcanzó; si no llega al primero, es 1.
const levelForTotal = async (total) => {
  const { rows } = await query(
    `SELECT COALESCE(MAX(trainer_level), 1) AS nivel
       FROM ${T} WHERE trainer_total_pokemon_levels_required <= $1`,
    [Number(total) || 0]
  )
  return Number(rows[0]?.nivel) || 1
}

// El cálculo vive en trainer_level.service, que es quien lo persiste. Aquí solo
// se consulta: tener dos implementaciones de la misma regla es la vía rápida a
// que la pantalla y la base de datos digan cosas distintas.
const pokeLevelsOf = async (id_personaje) => {
  const { rows } = await query(
    `SELECT personaje_pokeslots, personaje_level FROM ${TP} WHERE id_personaje = $1`, [id_personaje])
  if (!rows[0]) return 1
  return tl.pokeLevelsCon(id_personaje, rows[0].personaje_pokeslots, rows[0].personaje_level, query)
}

// Estado de nivel de un entrenador: cuántos niveles de Pokémon suma, qué nivel
// le corresponde y cuánto le falta para el siguiente. Solo lee, no persiste.
const trainerLevelState = async (id_personaje) => {
  const { rows: pRows } = await query(
    `SELECT personaje_level, personaje_pokelvls, personaje_pokeslots
       FROM ${TP} WHERE id_personaje = $1`, [id_personaje])
  if (!pRows[0]) return null

  const pokeLevels = await tl.pokeLevelsCon(
    id_personaje, pRows[0].personaje_pokeslots, pRows[0].personaje_level, query)
  const nivelReal  = await levelForTotal(pokeLevels)

  const { rows: sig } = await query(
    `SELECT trainer_level, trainer_total_pokemon_levels_required
       FROM ${T} WHERE trainer_total_pokemon_levels_required > $1
      ORDER BY trainer_total_pokemon_levels_required LIMIT 1`,
    [pokeLevels]
  )

  return {
    id_personaje: Number(id_personaje),
    pokeslots:        Number(pRows[0].personaje_pokeslots) || 0,
    pokelvls:         pokeLevels,                              // calculado ahora
    pokelvls_guardado: pRows[0].personaje_pokelvls,            // lo que hay en la tabla
    nivel_guardado:   Number(pRows[0].personaje_level) || 1,
    nivel_calculado:  nivelReal,
    // El nivel nunca baja: si pierde o libera Pokémon conserva lo alcanzado.
    sube:             nivelReal > (Number(pRows[0].personaje_level) || 1),
    siguiente_nivel:  sig[0] ? Number(sig[0].trainer_level) : null,
    faltan_para_siguiente: sig[0]
      ? Number(sig[0].trainer_total_pokemon_levels_required) - pokeLevels
      : null,
  }
}

module.exports = {
  findAll, findById, findByLevel,
  levelForTotal, pokeLevelsOf, trainerLevelState,
}
