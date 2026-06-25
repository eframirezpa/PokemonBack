const { query, SCHEMA } = require('../config/db')
const T   = `"${SCHEMA}"."backgrounds"`
const TF  = `"${SCHEMA}"."feats"`
const TFB = `"${SCHEMA}"."feats_bonus"`

const findAll = async ({ limit = 100, offset = 0, search = '' }) => {
  const params = []
  const where = search
    ? (params.push(`%${search}%`), `WHERE background_name ILIKE $1`)
    : ''
  params.push(limit, offset)

  const { rows } = await query(
    `SELECT * FROM ${T} ${where}
     ORDER BY background_name
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )
  const { rows: c } = await query(
    `SELECT COUNT(*) FROM ${T} ${where}`, search ? [`%${search}%`] : []
  )
  return { data: rows, total: Number(c[0].count) }
}

const findById = async (id) => {
  const { rows } = await query(`SELECT * FROM ${T} WHERE background_id = $1`, [id])
  return rows[0] || null
}

// Backgrounds con sus feat_bonuses (vía background_feat_id) para el wizard
const findForCharacterCreation = async () => {
  const { rows } = await query(
    `SELECT b.*,
            f.feat_benefits AS background_feat_benefits,
            COALESCE((
              SELECT json_agg(json_build_object(
                'type',  fb.feats_bonus_type,
                'llave', fb.feats_bonus_llave,
                'valor', fb.feats_bonus_valor
              ))
              FROM ${TFB} fb WHERE fb.id_feat = b.background_feat_id
            ), '[]') AS feat_bonuses
     FROM ${T} b
     LEFT JOIN ${TF} f ON f.feat_id = b.background_feat_id
     ORDER BY b.background_name`
  )
  return rows
}

module.exports = { findAll, findById, findForCharacterCreation }
