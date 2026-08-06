const { query, SCHEMA } = require('../config/db')
const T  = `"${SCHEMA}"."paths"`
const TB = `"${SCHEMA}"."path_bonus"`

// Los bonos de un path se agrupan bajo la ruta, igual que los feat_bonuses de
// backgrounds/origins: quien pinta la ficha no debería tener que hacer un
// segundo viaje ni cruzar arrays por su cuenta.
const BONOS = `
  COALESCE((
    SELECT json_agg(json_build_object(
      'id',               b.path_bonus_id,
      'level',            b.path_bonus_level,
      'feature_name_id',  b.path_bonus_feature_name_id,
      'feature_name',     b.path_bonus_feature_name,
      'type',             b.path_bonus_type,
      'target',           b.path_bonus_target,
      'key',              b.path_bonus_key,
      'value',            b.path_bonus_value,
      'resource_name',    b.path_bonus_resource_name,
      'resource_formula', b.path_bonus_resource_formula,
      'resource_die',     b.path_bonus_resource_die,
      'uses_formula',     b.path_bonus_uses_formula,
      'uses_value',       b.path_bonus_uses_value,
      'uses_recovery',    b.path_bonus_uses_recovery,
      'uses_limit',       b.path_bonus_uses_limit,
      'notes',            b.path_bonus_notes
    ) ORDER BY b.path_bonus_level, b.path_bonus_id)
    FROM ${TB} b WHERE b.path_id = p.path_id
  ), '[]') AS bonos`

const findAll = async () => {
  const { rows } = await query(
    `SELECT p.*, ${BONOS} FROM ${T} p ORDER BY p.path_name`)
  return rows
}

const findById = async (id) => {
  const { rows } = await query(
    `SELECT p.*, ${BONOS} FROM ${T} p WHERE p.path_id = $1`, [id])
  return rows[0] || null
}

// Por path_name_id ("ace-trainer"), que es estable frente a cambios de id
const findByNameId = async (nameId) => {
  const { rows } = await query(
    `SELECT p.*, ${BONOS} FROM ${T} p WHERE lower(p.path_name_id) = lower($1)`, [nameId])
  return rows[0] || null
}

// Bonos que un path otorga hasta cierto nivel. Las rutas dan rasgos en 2, 5, 9
// y 15, así que un entrenador de nivel 7 solo tiene los de 2 y 5.
const bonusUpToLevel = async (path_id, level) => {
  const { rows } = await query(
    `SELECT * FROM ${TB}
      WHERE path_id = $1 AND path_bonus_level <= $2
      ORDER BY path_bonus_level, path_bonus_id`,
    [path_id, Number(level) || 0]
  )
  return rows
}

module.exports = { findAll, findById, findByNameId, bonusUpToLevel }
