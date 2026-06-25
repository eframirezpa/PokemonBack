const { query, SCHEMA } = require('../config/db')
const T = `"${SCHEMA}"."feats_bonus"`

const findAll = async ({ id_feat } = {}) => {
  if (id_feat) {
    const { rows } = await query(
      `SELECT * FROM ${T} WHERE id_feat = $1 ORDER BY id_feats_bonus`,
      [id_feat]
    )
    return rows
  }
  const { rows } = await query(`SELECT * FROM ${T} ORDER BY id_feats_bonus`)
  return rows
}

const findById = async (id) => {
  const { rows } = await query(`SELECT * FROM ${T} WHERE id_feats_bonus = $1`, [id])
  return rows[0] || null
}

const findByFeat = async (id_feat) => {
  const { rows } = await query(
    `SELECT * FROM ${T} WHERE id_feat = $1 ORDER BY id_feats_bonus`,
    [id_feat]
  )
  return rows
}

const create = async ({ feats_bonus_type, feats_bonus_llave, feats_bonus_valor, id_feat }) => {
  const { rows } = await query(
    `INSERT INTO ${T} (feats_bonus_type, feats_bonus_llave, feats_bonus_valor, id_feat)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [feats_bonus_type ?? null, feats_bonus_llave ?? null, feats_bonus_valor ?? null, id_feat]
  )
  return rows[0]
}

const update = async (id, { feats_bonus_type, feats_bonus_llave, feats_bonus_valor, id_feat }) => {
  const fields = []
  const params = []

  if (feats_bonus_type !== undefined)  { params.push(feats_bonus_type);  fields.push(`feats_bonus_type = $${params.length}`) }
  if (feats_bonus_llave !== undefined) { params.push(feats_bonus_llave); fields.push(`feats_bonus_llave = $${params.length}`) }
  if (feats_bonus_valor !== undefined) { params.push(feats_bonus_valor); fields.push(`feats_bonus_valor = $${params.length}`) }
  if (id_feat !== undefined)           { params.push(id_feat);          fields.push(`id_feat = $${params.length}`) }

  if (!fields.length) return findById(id)

  params.push(id)
  const { rows } = await query(
    `UPDATE ${T} SET ${fields.join(', ')} WHERE id_feats_bonus = $${params.length} RETURNING *`,
    params
  )
  return rows[0] || null
}

const remove = async (id) => {
  const { rowCount } = await query(`DELETE FROM ${T} WHERE id_feats_bonus = $1`, [id])
  return rowCount > 0
}

module.exports = { findAll, findById, findByFeat, create, update, remove }
