const { query, transaction, SCHEMA } = require('../config/db')

const TMP    = `"${SCHEMA}"."master_pokemon"`
const TMPF   = `"${SCHEMA}"."master_pokemon_feat"`
const TMPFB  = `"${SCHEMA}"."master_pokemon_feat_bonus"`
const TFEATS = `"${SCHEMA}"."feats"`

// ¿El Pokémon pertenece al master autenticado?
const ownsPokemon = async (id_master, id_master_pokemon) => {
  const { rows } = await query(
    `SELECT 1 FROM ${TMP} WHERE id_master_pokemon = $1 AND id_master = $2`,
    [id_master_pokemon, id_master])
  return rows.length > 0
}

// Feats del Pokémon del master, con sus bonos resueltos
const findByPokemon = async (id_master, id_master_pokemon) => {
  if (!(await ownsPokemon(id_master, id_master_pokemon))) return null
  const { rows } = await query(
    `SELECT mf.master_pokemon_feat_id,
            mf.personaje_feat_is_available AS is_available,
            f.*,
            COALESCE((
              SELECT json_agg(json_build_object(
                'id',           b.master_pokemon_feat_bonus_id,
                'type',         b.master_pokemon_feat_bonus_type,
                'llave',        b.master_pokemon_feat_bonus_llave,
                'value',        b.master_pokemon_feat_bonus_value,
                'is_available', b.master_pokemon_feat_bonus_is_available
              ) ORDER BY b.master_pokemon_feat_bonus_id)
              FROM ${TMPFB} b
              WHERE b.master_pokemon_feat_bonus_master_pokemon_feat_id = mf.master_pokemon_feat_id
            ), '[]') AS bonos
     FROM ${TMPF} mf
     JOIN ${TFEATS} f ON f.feat_id = mf.feat_id
     WHERE mf.id_master_pokemon = $1
     ORDER BY mf.master_pokemon_feat_id`,
    [id_master_pokemon])
  return rows
}

// Agrega un feat al Pokémon con sus bonos ya resueltos ([{ type, llave, value }]).
// Si el feat no es repetible, no puede estar ya asignado.
const addFeat = async (id_master, id_master_pokemon, feat_id, bonos = []) => {
  if (!(await ownsPokemon(id_master, id_master_pokemon))) return { error: 'notfound' }
  const { rows: fRows } = await query(`SELECT * FROM ${TFEATS} WHERE feat_id = $1`, [feat_id])
  const feat = fRows[0]
  if (!feat) return { error: 'featnotfound' }
  if (Number(feat.feat_is_repeatable) !== 1) {
    const { rows: dup } = await query(
      `SELECT 1 FROM ${TMPF} WHERE id_master_pokemon = $1 AND feat_id = $2 LIMIT 1`,
      [id_master_pokemon, feat_id])
    if (dup.length) return { error: 'duplicate' }
  }
  return transaction(async (client) => {
    const { rows: ins } = await client.query(
      `INSERT INTO ${TMPF} (id_master_pokemon, feat_id) VALUES ($1, $2)
       RETURNING master_pokemon_feat_id`,
      [id_master_pokemon, feat_id])
    const mfId = ins[0].master_pokemon_feat_id
    for (const b of (bonos || [])) {
      await client.query(
        `INSERT INTO ${TMPFB}
           (master_pokemon_feat_bonus_master_pokemon_feat_id,
            master_pokemon_feat_bonus_type, master_pokemon_feat_bonus_llave, master_pokemon_feat_bonus_value)
         VALUES ($1, $2, $3, $4)`,
        [mfId, b.type ?? null, b.llave ?? null, b.value ?? null])
    }
    return { master_pokemon_feat_id: mfId, ...feat, is_available: true, bonos: bonos || [] }
  })
}

// Elimina un feat del Pokémon (sus bonos caen por cascada)
const removeFeat = async (id_master, id_master_pokemon, master_pokemon_feat_id) => {
  const { rowCount } = await query(
    `DELETE FROM ${TMPF}
     WHERE master_pokemon_feat_id = $1 AND id_master_pokemon = $2
       AND id_master_pokemon IN (SELECT id_master_pokemon FROM ${TMP} WHERE id_master = $3)`,
    [master_pokemon_feat_id, id_master_pokemon, id_master])
  return rowCount > 0
}

// Alterna la disponibilidad de un feat del Pokémon
const setFeatAvailable = async (id_master, id_master_pokemon, master_pokemon_feat_id, is_available) => {
  const { rowCount } = await query(
    `UPDATE ${TMPF} SET personaje_feat_is_available = $1
     WHERE master_pokemon_feat_id = $2 AND id_master_pokemon = $3
       AND id_master_pokemon IN (SELECT id_master_pokemon FROM ${TMP} WHERE id_master = $4)`,
    [!!is_available, master_pokemon_feat_id, id_master_pokemon, id_master])
  return rowCount > 0
}

module.exports = { findByPokemon, addFeat, removeFeat, setFeatAvailable }
