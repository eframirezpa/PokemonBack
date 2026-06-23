const { query, SCHEMA } = require('../config/db')
const T  = `"${SCHEMA}"."origins"`
const TF = `"${SCHEMA}"."feats"`

const findAll = async ({ limit = 100, offset = 0, search = '' }) => {
  const params = []
  const where = search
    ? (params.push(`%${search}%`), `WHERE origin_name ILIKE $1`)
    : ''
  params.push(limit, offset)

  const { rows } = await query(
    `SELECT * FROM ${T} ${where}
     ORDER BY origin_name
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )
  const { rows: c } = await query(
    `SELECT COUNT(*) FROM ${T} ${where}`, search ? [`%${search}%`] : []
  )
  return { data: rows, total: Number(c[0].count) }
}

const findById = async (id) => {
  const { rows } = await query(`SELECT * FROM ${T} WHERE origin_id = $1`, [id])
  return rows[0] || null
}

// Origins con instrucciones armadas para el wizard de creación de personaje
const findForCharacterCreation = async () => {
  const { rows } = await query(
    `SELECT
        o.origin_id,
        o.origin_name,
        o.origin_description,
        o.origin_ability_scores_name,
        o.origin_ability_scores_value_1,
        o.origin_ability_scores_value_2,
        CASE
            WHEN LOWER(COALESCE(o.origin_ability_scores_value_1, '')) = 'any'
              OR LOWER(COALESCE(o.origin_ability_scores_value_2, '')) = 'any'
            THEN CONCAT(
                COALESCE(o.origin_ability_scores_description, ''),
                ' Thanks to ',
                COALESCE(o.origin_ability_scores_name, 'this origin'),
                ', you can increase one ability score of your choice by +2 and a different ability score of your choice by +1.'
            )
            ELSE CONCAT(
                COALESCE(o.origin_ability_scores_description, ''),
                ' Thanks to ',
                COALESCE(o.origin_ability_scores_name, 'this origin'),
                ', you can increase your ',
                COALESCE(o.origin_ability_scores_value_1, 'chosen'),
                ' ability score by +2 and your ',
                COALESCE(o.origin_ability_scores_value_2, 'chosen'),
                ' ability score by +1.'
            )
        END AS origin_ability_scores_instruction,
        o.origin_skill_proficiencies_name,
        CONCAT(
            COALESCE(o.origin_skill_proficiencies_description, ''),
            ' Thanks to ',
            COALESCE(o.origin_skill_proficiencies_name, 'this origin'),
            ', you gain proficiency in ',
            COALESCE(o.origin_skill_proficiencies_value_1, 'one skill'),
            '.'
        ) AS origin_skill_proficiencies_instruction,
        o.origin_feat_name,
        CONCAT('Thanks to ', o.origin_feat_name, ', ', f.feat_benefits) AS origin_feat_benefits
     FROM ${T} o
     LEFT JOIN ${TF} f ON f.feat_id = o.origin_feat_id
     ORDER BY o.origin_name`
  )
  return rows
}

module.exports = { findAll, findById, findForCharacterCreation }
