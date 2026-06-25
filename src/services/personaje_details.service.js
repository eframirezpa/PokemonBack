const { query, SCHEMA } = require('../config/db')
const T = `"${SCHEMA}"."personaje_details"`

const findByPersonaje = async (id_personaje) => {
  const { rows } = await query(
    `SELECT * FROM ${T} WHERE id_personaje = $1 ORDER BY id_personaje_detail`,
    [id_personaje]
  )
  return rows
}

const findById = async (id) => {
  const { rows } = await query(`SELECT * FROM ${T} WHERE id_personaje_detail = $1`, [id])
  return rows[0] || null
}

const create = async ({ nombre_personaje_detail, descripcion_personaje_detail, id_personaje }) => {
  const { rows } = await query(
    `INSERT INTO ${T} (nombre_personaje_detail, descripcion_personaje_detail, id_personaje)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [nombre_personaje_detail ?? null, descripcion_personaje_detail ?? null, id_personaje]
  )
  return rows[0]
}

const update = async (id, { nombre_personaje_detail, descripcion_personaje_detail }) => {
  const fields = []
  const params = []

  if (nombre_personaje_detail !== undefined)      { params.push(nombre_personaje_detail);      fields.push(`nombre_personaje_detail = $${params.length}`) }
  if (descripcion_personaje_detail !== undefined) { params.push(descripcion_personaje_detail); fields.push(`descripcion_personaje_detail = $${params.length}`) }

  if (!fields.length) return findById(id)

  params.push(id)
  const { rows } = await query(
    `UPDATE ${T} SET ${fields.join(', ')} WHERE id_personaje_detail = $${params.length} RETURNING *`,
    params
  )
  return rows[0] || null
}

const remove = async (id) => {
  const { rowCount } = await query(`DELETE FROM ${T} WHERE id_personaje_detail = $1`, [id])
  return rowCount > 0
}

module.exports = { findByPersonaje, findById, create, update, remove }
