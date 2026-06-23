const { query, SCHEMA } = require('../config/db')
const T   = `"${SCHEMA}"."personaje"`
const TS  = `"${SCHEMA}"."personaje_stats"`
const TUP = `"${SCHEMA}"."usuarios_partida"`

// Devuelve el id_usuarios_partida de la participación (user + partida)
const getParticipacion = async (id_partida, user_id) => {
  const { rows } = await query(
    `SELECT id_usuarios_partida FROM ${TUP} WHERE id_partida = $1 AND user_id = $2`,
    [id_partida, user_id]
  )
  return rows[0]?.id_usuarios_partida || null
}

// Personajes del usuario dentro de una partida
const findByPartidaUser = async (id_partida, user_id) => {
  const { rows } = await query(
    `SELECT p.*
     FROM ${T} p
     JOIN ${TUP} up ON up.id_usuarios_partida = p.id_usuario_partida
     WHERE up.id_partida = $1 AND up.user_id = $2
     ORDER BY p.id_personaje`,
    [id_partida, user_id]
  )
  return rows
}

const findById = async (id_personaje) => {
  const { rows } = await query(
    `SELECT p.*, s.personaje_str, s.personaje_dex, s.personaje_con,
            s.personaje_int, s.personaje_wis, s.personaje_cha
     FROM ${T} p
     LEFT JOIN ${TS} s ON s.id_personaje = p.id_personaje
     WHERE p.id_personaje = $1`,
    [id_personaje]
  )
  return rows[0] || null
}

// Crea un personaje (+ su fila de stats) para la participación user+partida
const create = async (id_partida, user_id, data) => {
  const idUP = await getParticipacion(id_partida, user_id)
  if (!idUP) return null

  const {
    nombre_personaje = null,
    personaje_origin = null,
    personaje_background = null,
    stats = {},
  } = data

  const { rows } = await query(
    `INSERT INTO ${T} (nombre_personaje, personaje_origin, personaje_background, id_usuario_partida)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [nombre_personaje, personaje_origin, personaje_background, idUP]
  )
  const personaje = rows[0]

  const s = {
    personaje_str: stats.personaje_str ?? 0,
    personaje_dex: stats.personaje_dex ?? 0,
    personaje_con: stats.personaje_con ?? 0,
    personaje_int: stats.personaje_int ?? 0,
    personaje_wis: stats.personaje_wis ?? 0,
    personaje_cha: stats.personaje_cha ?? 0,
  }
  await query(
    `INSERT INTO ${TS} (personaje_str, personaje_dex, personaje_con, personaje_int, personaje_wis, personaje_cha, id_personaje)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [s.personaje_str, s.personaje_dex, s.personaje_con, s.personaje_int, s.personaje_wis, s.personaje_cha, personaje.id_personaje]
  )

  return { ...personaje, ...s }
}

module.exports = { findByPartidaUser, findById, create }
