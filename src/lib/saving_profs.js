// Tiradas de salvación en las que un entrenador YA es proficiente.
//
// Vienen de dos sitios y hay que mirar los dos, porque la ficha las suma igual:
//
//   1. Las columnas personaje_stats_<stat>_prof, que es donde las deja la
//      creación y Trainer's Resolve.
//   2. Los bonos de tipo 'saving' de sus feats. Estos NO tocan esas columnas:
//      se aplican al leer, así que la columna sigue en false aunque el jugador
//      ya tire con proficiencia.
//
// Los feats de origen y background se cuentan aparte porque no viven en
// personaje_feat: los otorga el origen o el background y se leen del catálogo.
//
// Vive aquí y no dentro de la subida de nivel porque el mismo cálculo hace
// falta al ofrecer la elección y al validarla; si cada uno lo hiciera a su
// manera, la ventana podría ofrecer una salvación que el guardia rechaza.
const { query, SCHEMA } = require('../config/db')

const STAT_KEYS = ['dex', 'str', 'con', 'int', 'wis', 'cha']
const norm = s => String(s ?? '').toLowerCase().trim()

const savingProfsDe = async (id_personaje, run = query) => {
  const tiene = new Set()

  // 1. Las columnas de personaje_stats
  const { rows: st } = await run(
    `SELECT * FROM "${SCHEMA}"."personaje_stats" WHERE id_personaje = $1`, [id_personaje])
  for (const k of STAT_KEYS) if (st[0]?.[`personaje_stats_${k}_prof`]) tiene.add(k)

  // 2. Los feats agregados al personaje. Un feat desactivado desde la ficha no
  //    cuenta, igual que en el resto de sus efectos.
  const { rows: deFeats } = await run(
    `SELECT fb.personaje_feat_bonus_llave AS llave
       FROM "${SCHEMA}"."personaje_feat_bonus" fb
       JOIN "${SCHEMA}"."personaje_feat" pf
         ON pf.personaje_feat_id = fb.personaje_feat_bonus_personaje_feat_id
      WHERE pf.personaje_id = $1
        AND fb.personaje_feat_bonus_type ILIKE 'saving'
        AND COALESCE(fb.personaje_feat_bonus_is_available, TRUE)
        AND COALESCE(pf.personaje_feat_is_available, TRUE)`, [id_personaje])
  for (const r of deFeats) tiene.add(norm(r.llave))

  // 3. Los rasgos de origen y background, que no se guardan en personaje_feat
  const { rows: deCuna } = await run(
    `SELECT fb.feats_bonus_llave AS llave
       FROM "${SCHEMA}"."personaje" p
       LEFT JOIN "${SCHEMA}"."origins"     o ON o.origin_id     = p.personaje_origin
       LEFT JOIN "${SCHEMA}"."backgrounds" b ON b.background_id = p.personaje_background
       JOIN "${SCHEMA}"."feats_bonus" fb
         ON fb.id_feat IN (o.origin_feat_id, b.background_feat_id)
      WHERE p.id_personaje = $1
        AND fb.feats_bonus_type ILIKE 'saving'`, [id_personaje])
  for (const r of deCuna) tiene.add(norm(r.llave))

  return tiene
}

/** Las que puede elegir Trainer's Resolve: las que aún NO tiene. */
const savingDisponibles = async (id_personaje, run = query) => {
  const tiene = await savingProfsDe(id_personaje, run)
  return STAT_KEYS.filter(k => !tiene.has(k))
}

module.exports = { STAT_KEYS, savingProfsDe, savingDisponibles }
