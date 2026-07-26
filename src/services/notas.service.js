const { query, SCHEMA } = require('../config/db')
const T = `"${SCHEMA}"."notas"`

const findByPersonaje = async (id_personaje) => {
  const { rows } = await query(
    `SELECT * FROM ${T} WHERE id_personaje = $1 ORDER BY id_nota`,
    [id_personaje]
  )
  return rows
}

const findById = async (id) => {
  const { rows } = await query(`SELECT * FROM ${T} WHERE id_nota = $1`, [id])
  return rows[0] || null
}

const create = async ({ id_personaje, tipo_nota, nota, is_done_nota }) => {
  const { rows } = await query(
    `INSERT INTO ${T} (id_personaje, tipo_nota, nota, is_done_nota)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [id_personaje, tipo_nota ?? null, nota ?? null, !!is_done_nota]
  )
  return rows[0]
}

const update = async (id, { tipo_nota, nota, is_done_nota }) => {
  const fields = []
  const params = []
  if (tipo_nota    !== undefined) { params.push(tipo_nota);        fields.push(`tipo_nota = $${params.length}`) }
  if (nota         !== undefined) { params.push(nota);             fields.push(`nota = $${params.length}`) }
  if (is_done_nota !== undefined) { params.push(!!is_done_nota);   fields.push(`is_done_nota = $${params.length}`) }

  if (!fields.length) return findById(id)

  params.push(id)
  const { rows } = await query(
    `UPDATE ${T} SET ${fields.join(', ')} WHERE id_nota = $${params.length} RETURNING *`,
    params
  )
  return rows[0] || null
}

const remove = async (id) => {
  const { rowCount } = await query(`DELETE FROM ${T} WHERE id_nota = $1`, [id])
  return rowCount > 0
}

module.exports = { findByPersonaje, findById, create, update, remove }
