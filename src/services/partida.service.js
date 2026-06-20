const { query, SCHEMA } = require('../config/db')
const T = `"${SCHEMA}"."partida"`

const findActiveByUser = async (user_id) => {
  const UP = `"${SCHEMA}"."usuarios_partida"`
  const { rows } = await query(
    `SELECT p.* FROM ${T} p
     JOIN ${UP} up ON up.id_partida = p.id_partida
     WHERE up.user_id = $1 AND p.activada_partida = true
     ORDER BY p.id_partida DESC`,
    [user_id]
  )
  return rows
}

const findByOwner = async (owner_id) => {
  const { rows } = await query(
    `SELECT * FROM ${T} WHERE owner_partida = $1 ORDER BY id_partida DESC`,
    [owner_id]
  )
  return rows
}

const findById = async (id) => {
  const { rows } = await query(`SELECT * FROM ${T} WHERE id_partida = $1`, [id])
  return rows[0] || null
}

const create = async ({ nombre, descripcion, titulo1, leyenda1, titulo2, leyenda2, titulo3, leyenda3, owner_id }) => {
  const { rows } = await query(
    `INSERT INTO ${T}
       (nombre_partida, descripcion_partida,
        titulo1_partida, leyenda1_partida,
        titulo2_partida, leyenda2_partida,
        titulo3_partida, leyenda3_partida,
        activada_partida, owner_partida)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9)
     RETURNING *`,
    [nombre, descripcion, titulo1, leyenda1, titulo2, leyenda2, titulo3, leyenda3, owner_id]
  )
  return rows[0]
}

const updateSprites = async (id, { sprite1, sprite2, sprite3 }) => {
  const { rows } = await query(
    `UPDATE ${T}
     SET sprite1_partida = $1, sprite2_partida = $2, sprite3_partida = $3, updated_at = NOW()
     WHERE id_partida = $4 RETURNING *`,
    [sprite1, sprite2, sprite3, id]
  )
  return rows[0]
}

const update = async (id, { nombre, descripcion, titulo1, leyenda1, titulo2, leyenda2, titulo3, leyenda3 }) => {
  const { rows } = await query(
    `UPDATE ${T}
     SET nombre_partida=$1, descripcion_partida=$2,
         titulo1_partida=$3, leyenda1_partida=$4,
         titulo2_partida=$5, leyenda2_partida=$6,
         titulo3_partida=$7, leyenda3_partida=$8,
         updated_at=NOW()
     WHERE id_partida=$9 RETURNING *`,
    [nombre, descripcion, titulo1, leyenda1, titulo2, leyenda2, titulo3, leyenda3, id]
  )
  return rows[0] || null
}

const toggleActivada = async (id) => {
  const { rows } = await query(
    `UPDATE ${T} SET activada_partida = NOT activada_partida, updated_at = NOW()
     WHERE id_partida = $1 RETURNING *`,
    [id]
  )
  return rows[0] || null
}

const remove = async (id) => {
  const { rowCount } = await query(`DELETE FROM ${T} WHERE id_partida = $1`, [id])
  return rowCount > 0
}

module.exports = { findActiveByUser, findByOwner, findById, create, updateSprites, update, toggleActivada, remove }
