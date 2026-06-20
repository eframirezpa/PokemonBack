const { query, SCHEMA } = require('../config/db')
const T  = `"${SCHEMA}"."usuarios_partida"`
const TU = `"${SCHEMA}"."usuarios"`
const TR = `"${SCHEMA}"."roles"`

const findByPartida = async (id_partida) => {
  const { rows } = await query(
    `SELECT u.user_id, u.user_name, r.role_name
     FROM ${T} up
     JOIN ${TU} u ON u.user_id = up.user_id
     JOIN ${TR} r ON r.role_id = u.role_id
     WHERE up.id_partida = $1
     ORDER BY u.user_name`,
    [id_partida]
  )
  return rows
}

const findAvailable = async (id_partida) => {
  const { rows } = await query(
    `SELECT u.user_id, u.user_name, r.role_name
     FROM ${TU} u
     JOIN ${TR} r ON r.role_id = u.role_id
     WHERE r.role_name IN ('trainer', 'espectador')
       AND u.user_id NOT IN (
         SELECT user_id FROM ${T} WHERE id_partida = $1
       )
     ORDER BY u.user_name`,
    [id_partida]
  )
  return rows
}

const add = async (id_partida, user_id) => {
  const { rows } = await query(
    `INSERT INTO ${T} (id_partida, user_id) VALUES ($1, $2)
     ON CONFLICT (user_id, id_partida) DO NOTHING
     RETURNING *`,
    [id_partida, user_id]
  )
  return rows[0] || null
}

const remove = async (id_partida, user_id) => {
  const { rowCount } = await query(
    `DELETE FROM ${T} WHERE id_partida = $1 AND user_id = $2`,
    [id_partida, user_id]
  )
  return rowCount > 0
}

module.exports = { findByPartida, findAvailable, add, remove }
