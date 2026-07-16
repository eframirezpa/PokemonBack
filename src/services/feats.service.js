const { query, SCHEMA } = require('../config/db')
const T = `"${SCHEMA}"."feats"`
const TFB = `"${SCHEMA}"."feats_bonus"`

const findAll = async ({ limit = 100, offset = 0, search = '', type = '' }) => {
  const params = []
  const conditions = []

  if (search) {
    params.push(`%${search}%`)
    conditions.push(`feat_name ILIKE $${params.length}`)
  }
  if (type) {
    const types = type.split(',').map(t => t.trim()).filter(Boolean)
    if (types.length === 1) {
      params.push(types[0])
      conditions.push(`feat_type = $${params.length}`)
    } else {
      params.push(types)
      conditions.push(`feat_type = ANY($${params.length}::text[])`)
    }
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  params.push(limit, offset)

  const { rows } = await query(
    `SELECT f.*, COALESCE((
        SELECT json_agg(json_build_object(
          'type',       fb.feats_bonus_type,
          'llave',      fb.feats_bonus_llave,
          'valor',      fb.feats_bonus_valor,
          'prereq',     fb.feats_bonus_prerequisito,
          'prereqValor', fb.feats_bonus_prerequisito_valor
        ) ORDER BY fb.id_feats_bonus)
        FROM ${TFB} fb WHERE fb.id_feat = f.feat_id
      ), '[]') AS feat_bonuses
     FROM ${T} f ${where}
     ORDER BY feat_name
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )
  const { rows: c } = await query(
    `SELECT COUNT(*) FROM ${T} ${where}`, params.slice(0, -2)
  )
  return { data: rows, total: Number(c[0].count) }
}

const findById = async (id) => {
  const { rows } = await query(`SELECT * FROM ${T} WHERE feat_id = $1`, [id])
  return rows[0] || null
}

module.exports = { findAll, findById }
