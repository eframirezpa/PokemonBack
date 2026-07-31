const { query, transaction, SCHEMA } = require('../config/db')

const TPP    = `"${SCHEMA}"."personaje_pokemon"`
const TPPF   = `"${SCHEMA}"."personaje_pokemon_feat"`
const TPPFB  = `"${SCHEMA}"."personaje_pokemon_feat_bonus"`
const TFEATS = `"${SCHEMA}"."feats"`

// Feats del Pokémon del entrenador (id_trainer_pokemon = id_personaje_pokemon), con bonos resueltos
const findByPokemon = async (id_trainer_pokemon) => {
  const { rows } = await query(
    `SELECT pf.personaje_pokemon_feat_id,
            pf.personaje_feat_is_available AS is_available,
            f.*,
            COALESCE((
              SELECT json_agg(json_build_object(
                'id',           b.personaje_pokemon_feat_bonus_id,
                'type',         b.personaje_pokemon_feat_bonus_type,
                'llave',        b.personaje_pokemon_feat_bonus_llave,
                'value',        b.personaje_pokemon_feat_bonus_value,
                'is_available', b.personaje_pokemon_feat_bonus_is_available
              ) ORDER BY b.personaje_pokemon_feat_bonus_id)
              FROM ${TPPFB} b
              WHERE b.personaje_pokemon_feat_bonus_personaje_pokemon_feat_id = pf.personaje_pokemon_feat_id
            ), '[]') AS bonos
     FROM ${TPPF} pf
     JOIN ${TFEATS} f ON f.feat_id = pf.feat_id
     WHERE pf.id_trainer_pokemon = $1
     ORDER BY pf.personaje_pokemon_feat_id`,
    [id_trainer_pokemon])
  return rows
}

// Agrega un feat al Pokémon con sus bonos ya resueltos ([{ type, llave, value }]).
// Si el feat no es repetible, no puede estar ya asignado.
const addFeat = async (id_trainer_pokemon, feat_id, bonos = []) => {
  const { rows: ppRows } = await query(`SELECT 1 FROM ${TPP} WHERE id_personaje_pokemon = $1`, [id_trainer_pokemon])
  if (!ppRows.length) return { error: 'notfound' }
  const { rows: fRows } = await query(`SELECT * FROM ${TFEATS} WHERE feat_id = $1`, [feat_id])
  const feat = fRows[0]
  if (!feat) return { error: 'featnotfound' }
  if (Number(feat.feat_is_repeatable) !== 1) {
    const { rows: dup } = await query(
      `SELECT 1 FROM ${TPPF} WHERE id_trainer_pokemon = $1 AND feat_id = $2 LIMIT 1`,
      [id_trainer_pokemon, feat_id])
    if (dup.length) return { error: 'duplicate' }
  }
  return transaction(async (client) => {
    const { rows: ins } = await client.query(
      `INSERT INTO ${TPPF} (id_trainer_pokemon, feat_id) VALUES ($1, $2)
       RETURNING personaje_pokemon_feat_id`,
      [id_trainer_pokemon, feat_id])
    const pfId = ins[0].personaje_pokemon_feat_id
    for (const b of (bonos || [])) {
      await client.query(
        `INSERT INTO ${TPPFB}
           (personaje_pokemon_feat_bonus_personaje_pokemon_feat_id,
            personaje_pokemon_feat_bonus_type, personaje_pokemon_feat_bonus_llave, personaje_pokemon_feat_bonus_value)
         VALUES ($1, $2, $3, $4)`,
        [pfId, b.type ?? null, b.llave ?? null, b.value ?? null])
    }
    return { personaje_pokemon_feat_id: pfId, ...feat, is_available: true, bonos: bonos || [] }
  })
}

// Elimina un feat del Pokémon (sus bonos caen por cascada)
const removeFeat = async (id_trainer_pokemon, personaje_pokemon_feat_id) => {
  const { rowCount } = await query(
    `DELETE FROM ${TPPF} WHERE personaje_pokemon_feat_id = $1 AND id_trainer_pokemon = $2`,
    [personaje_pokemon_feat_id, id_trainer_pokemon])
  return rowCount > 0
}

// Alterna la disponibilidad de un feat del Pokémon
const setFeatAvailable = async (id_trainer_pokemon, personaje_pokemon_feat_id, is_available) => {
  const { rowCount } = await query(
    `UPDATE ${TPPF} SET personaje_feat_is_available = $1
     WHERE personaje_pokemon_feat_id = $2 AND id_trainer_pokemon = $3`,
    [!!is_available, personaje_pokemon_feat_id, id_trainer_pokemon])
  return rowCount > 0
}

module.exports = { findByPokemon, addFeat, removeFeat, setFeatAvailable }
