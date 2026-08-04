const { query, transaction, SCHEMA } = require('../config/db')

const TPP     = `"${SCHEMA}"."personaje_pokemon"`
const TPPI    = `"${SCHEMA}"."personaje_pokemon_pending_improvement"`
const TPS     = `"${SCHEMA}"."pokemon_stats"`
const TPSK    = `"${SCHEMA}"."pokemon_skills"`
const TSKILLS = `"${SCHEMA}"."skills"`
const TPPM    = `"${SCHEMA}"."personaje_pokemon_moves"`
const TMOVES  = `"${SCHEMA}"."moves"`
const TPOKEDEX= `"${SCHEMA}"."pokemon"`
const TPPF    = `"${SCHEMA}"."personaje_pokemon_feat"`
const TPPFB   = `"${SCHEMA}"."personaje_pokemon_feat_bonus"`
const TFEATS  = `"${SCHEMA}"."feats"`
const TEVO    = `"${SCHEMA}"."evolution"`

const STAT_KEYS = ['dex', 'str', 'con', 'int', 'wis', 'cha']
const STRUGGLE_ID = 705
const ASI_TYPE = 'ability score improvement'
// "d10" → 10. El dado de golpe vive en la tabla pokemon como texto.
const hitDiceMax = s => { const m = /(\d+)/.exec(s || ''); return m ? Number(m[1]) : 0 }
const splitList = s => (s || '').split(',').map(x => x.trim()).filter(Boolean)
const norm = s => (s || '').toLowerCase().trim()
// Columnas de "New Moves" por nivel en la tabla pokemon
const NEW_MOVE_COL = { 2: 'pokemon_moves_level2', 6: 'pokemon_moves_level6', 10: 'pokemon_moves_level10', 14: 'pokemon_moves_level14', 18: 'pokemon_moves_level18' }

// Tamaño de la línea evolutiva (1/2/3) = componente conexo en la tabla evolution
const evolutionLine = async (id_pokemon) => {
  const { rows } = await query(`SELECT evolution_from_pokemon_id f, evolution_to_pokemon_id t FROM ${TEVO}`)
  const adj = new Map()
  const link = (a, b) => { if (a == null || b == null) return; if (!adj.has(a)) adj.set(a, new Set()); adj.get(a).add(b) }
  for (const e of rows) { link(e.f, e.t); link(e.t, e.f) }
  const seen = new Set([id_pokemon]); const stack = [id_pokemon]
  while (stack.length) { const cur = stack.pop(); for (const n of (adj.get(cur) || [])) if (!seen.has(n)) { seen.add(n); stack.push(n) } }
  return Math.min(seen.size, 3)
}
const pointsForLine = line => (line === 1 ? 4 : line === 2 ? 3 : 2)

// Pool de movimientos disponible según el nivel: inicio + cada "New Moves" alcanzado
const movePoolNames = (pk, level) => {
  const names = splitList(pk.pokemon_moves_start)
  for (const [L, col] of Object.entries(NEW_MOVE_COL)) {
    if (level >= Number(L)) names.push(...splitList(pk[col]))
  }
  return [...new Set(names.map(n => norm(n)).filter(Boolean))]
}

// Lista de mejoras pendientes (applied = false) de todos los Pokémon de un personaje,
// con los datos que necesita cada ventana (movimientos o ASI).
const listPending = async (id_personaje) => {
  const { rows: pend } = await query(
    `SELECT pi.personaje_pokemon_pending_improvement_id     AS id,
            pi.personaje_pokemon_pending_improvement_pokemon_id AS idpp,
            pi.personaje_pokemon_pending_improvement_lvl     AS lvl,
            pi.personaje_pokemon_pending_improvement_type    AS type,
            pp.pokemon_apodo, pp.id_pokemon, pp.pokemon_level,
            pk.pokemon_name, pk.pokemon_media_sprite, pk.pokemon_media_sprite_shiny,
            pk.pokemon_hit_dice, pp.pokemon_is_shiny
     FROM ${TPPI} pi
     JOIN ${TPP} pp ON pp.id_personaje_pokemon = pi.personaje_pokemon_pending_improvement_pokemon_id
     JOIN ${TPOKEDEX} pk ON pk.pokemon_id = pp.id_pokemon
     WHERE pp.id_personaje = $1 AND pi.personaje_pokemon_pending_improvement_applied = false
     ORDER BY pi.personaje_pokemon_pending_improvement_id`,
    [id_personaje])

  const out = []
  for (const p of pend) {
    const isAsi = norm(p.type) === ASI_TYPE
    const level = Number(p.pokemon_level) || 1
    const item = {
      id: p.id, id_personaje_pokemon: p.idpp, apodo: p.pokemon_apodo,
      name: p.pokemon_name, level, type: p.type, is_asi: isAsi,
      sprite: (p.pokemon_is_shiny && p.pokemon_media_sprite_shiny) ? p.pokemon_media_sprite_shiny : p.pokemon_media_sprite,
      // Dado de golpe para la tirada de HP del nivel (ej. "d10" y 10)
      hit_dice: p.pokemon_hit_dice || null,
      hit_dice_max: hitDiceMax(p.pokemon_hit_dice),
    }
    if (isAsi) {
      const { rows: st } = await query(`SELECT * FROM ${TPS} WHERE id_personaje_pokemon = $1`, [p.idpp])
      item.stats = st[0] || null
      const { rows: skills } = await query(
        `SELECT s.skill_id, s.skill_name, s.skill_related_ability, ps.pokemon_skill_pref, ps.pokemon_skill_expert
         FROM ${TPSK} ps JOIN ${TSKILLS} s ON s.skill_id = ps.id_skill
         WHERE ps.id_personaje_pokemon = $1 ORDER BY ps.id_pokemon_skills`, [p.idpp])
      item.skills = skills
      // Feats que el Pokémon ya tiene: los no repetibles no deben volver a ofrecerse
      const { rows: owned } = await query(
        `SELECT feat_id FROM ${TPPF} WHERE id_trainer_pokemon = $1`, [p.idpp])
      item.owned_feat_ids = owned.map(f => f.feat_id)
      const line = await evolutionLine(p.id_pokemon)
      item.evolution_line = line
      item.points = pointsForLine(line)
    } else {
      const { rows: learned } = await query(
        `SELECT m.move_id, m.move_name, m.move_type
         FROM ${TPPM} pm JOIN ${TMOVES} m ON m.move_id = pm.personaje_pokemon_moves_move_id
         WHERE pm.personaje_pokemon_moves_personaje_pokemon_id = $1
         ORDER BY pm.personaje_pokemon_moves_id`, [p.idpp])
      item.learned_moves = learned.filter(m => m.move_id !== STRUGGLE_ID)
      const { rows: pkRows } = await query(`SELECT * FROM ${TPOKEDEX} WHERE pokemon_id = $1`, [p.id_pokemon])
      const poolNames = pkRows[0] ? movePoolNames(pkRows[0], level) : []
      let pool = []
      if (poolNames.length) {
        const { rows: mrows } = await query(
          `SELECT move_id, move_name, move_type FROM ${TMOVES} WHERE lower(move_name) = ANY($1)`, [poolNames])
        pool = mrows.filter(m => m.move_id !== STRUGGLE_ID)
      }
      item.move_pool = pool
    }
    out.push(item)
  }
  return out
}

// Verifica que exista un pending sin aplicar del pokémon, propiedad del personaje.
const findPending = async (id_personaje, id_personaje_pokemon, wantAsi) => {
  const { rows } = await query(
    `SELECT pi.personaje_pokemon_pending_improvement_id AS id,
            pi.personaje_pokemon_pending_improvement_type AS type,
            pp.id_pokemon, pp.pokemon_level, pk.pokemon_hit_dice
     FROM ${TPPI} pi
     JOIN ${TPP} pp ON pp.id_personaje_pokemon = pi.personaje_pokemon_pending_improvement_pokemon_id
     JOIN ${TPOKEDEX} pk ON pk.pokemon_id = pp.id_pokemon
     WHERE pi.personaje_pokemon_pending_improvement_pokemon_id = $1
       AND pp.id_personaje = $2
       AND pi.personaje_pokemon_pending_improvement_applied = false
     LIMIT 1`, [id_personaje_pokemon, id_personaje])
  const row = rows[0]
  if (!row) return null
  const isAsi = norm(row.type) === ASI_TYPE
  if (wantAsi != null && isAsi !== wantAsi) return null
  return row
}

// Valida la tirada del dado de golpe del nivel: entero entre 1 y el dado del Pokémon.
const checkHpRoll = (pend, rollRaw) => {
  const max = hitDiceMax(pend.pokemon_hit_dice)
  const roll = Math.floor(Number(rollRaw))
  if (!Number.isFinite(roll) || roll < 1 || (max > 0 && roll > max)) return { error: 'hproll', max }
  return { roll }
}

// Suma la tirada al HP guardado. El máximo y el actual suben lo mismo: ganar vida
// máxima al subir de nivel la otorga de inmediato.
const applyHpRoll = (client, id_personaje_pokemon, roll) =>
  client.query(
    `UPDATE ${TPP} SET pokemon_hp = COALESCE(pokemon_hp, 0) + $1,
                       pokemon_current_hp = COALESCE(pokemon_current_hp, 0) + $1
     WHERE id_personaje_pokemon = $2`,
    [roll, id_personaje_pokemon])

// Confirma el flujo de movimientos: reemplaza el moveset (Struggle siempre + hasta 4).
const confirmMoves = async (id_personaje, id_personaje_pokemon, moveIdsRaw, hpRollRaw) => {
  const pend = await findPending(id_personaje, id_personaje_pokemon, false)
  if (!pend) return { error: 'notfound' }
  const hp = checkHpRoll(pend, hpRollRaw)
  if (hp.error) return hp
  const ids = [...new Set((moveIdsRaw || []).map(Number).filter(Boolean))].filter(id => id !== STRUGGLE_ID)
  if (ids.length > 4) return { error: 'toomany' }
  // Validar que estén dentro del pool disponible
  const { rows: pkRows } = await query(`SELECT * FROM ${TPOKEDEX} WHERE pokemon_id = $1`, [pend.id_pokemon])
  const poolNames = pkRows[0] ? movePoolNames(pkRows[0], Number(pend.pokemon_level) || 1) : []
  let poolIds = new Set()
  if (poolNames.length) {
    const { rows: mrows } = await query(`SELECT move_id FROM ${TMOVES} WHERE lower(move_name) = ANY($1)`, [poolNames])
    poolIds = new Set(mrows.map(m => m.move_id))
  }
  if (ids.some(id => !poolIds.has(id))) return { error: 'invalidmove' }
  return transaction(async (client) => {
    await client.query(`DELETE FROM ${TPPM} WHERE personaje_pokemon_moves_personaje_pokemon_id = $1`, [id_personaje_pokemon])
    for (const mid of [STRUGGLE_ID, ...ids]) {
      await client.query(
        `INSERT INTO ${TPPM} (personaje_pokemon_moves_move_id, personaje_pokemon_moves_personaje_pokemon_id)
         VALUES ($1, $2)`, [mid, id_personaje_pokemon])
    }
    await applyHpRoll(client, id_personaje_pokemon, hp.roll)
    await client.query(
      `UPDATE ${TPPI} SET personaje_pokemon_pending_improvement_applied = true
       WHERE personaje_pokemon_pending_improvement_id = $1`, [pend.id])
    return { ok: true, hp_roll: hp.roll }
  })
}

// Confirma el flujo ASI: aplica los puntos a stats base (tope 20/22) y persiste un feat.
// statAdds = { dex, str, ... } enteros ≥ 0; feat = { feat_id, bonos:[{type,llave,value}] } | null
const confirmAsi = async (id_personaje, id_personaje_pokemon, statAdds, feat, hpRollRaw) => {
  const pend = await findPending(id_personaje, id_personaje_pokemon, true)
  if (!pend) return { error: 'notfound' }
  const hp = checkHpRoll(pend, hpRollRaw)
  if (hp.error) return hp
  const level = Number(pend.pokemon_level) || 1
  const line = await evolutionLine(pend.id_pokemon)
  const points = pointsForLine(line)

  const statSum = STAT_KEYS.reduce((a, k) => a + Math.max(0, Math.floor(Number(statAdds?.[k]) || 0)), 0)
  const hasFeat = !!(feat && feat.feat_id)
  const featCost = hasFeat ? 2 : 0
  // Se deben gastar todos los puntos disponibles
  if (statSum + featCost !== points) return { error: 'points', points }

  if (hasFeat) {
    const { rows: fRows } = await query(`SELECT feat_is_repeatable FROM ${TFEATS} WHERE feat_id = $1`, [Number(feat.feat_id)])
    if (!fRows.length) return { error: 'featnotfound' }
    // Un feat no repetible no puede asignarse dos veces al mismo Pokémon
    if (Number(fRows[0].feat_is_repeatable) !== 1) {
      const { rows: dup } = await query(
        `SELECT 1 FROM ${TPPF} WHERE id_trainer_pokemon = $1 AND feat_id = $2 LIMIT 1`,
        [id_personaje_pokemon, Number(feat.feat_id)])
      if (dup.length) return { error: 'duplicate' }
    }
  }

  const cap = level >= 20 ? 22 : 20
  return transaction(async (client) => {
    const { rows: st } = await client.query(`SELECT * FROM ${TPS} WHERE id_personaje_pokemon = $1`, [id_personaje_pokemon])
    const cur = st[0] || {}
    const sets = [], params = []
    for (const k of STAT_KEYS) {
      const add = Math.max(0, Math.floor(Number(statAdds?.[k]) || 0))
      if (add > 0) {
        const newVal = Math.min((Number(cur[`pokemon_${k}`]) || 0) + add, cap)
        params.push(newVal); sets.push(`pokemon_${k} = $${params.length}`)
      }
    }
    if (sets.length) {
      params.push(id_personaje_pokemon)
      await client.query(`UPDATE ${TPS} SET ${sets.join(', ')} WHERE id_personaje_pokemon = $${params.length}`, params)
    }
    if (hasFeat) {
      const { rows: ins } = await client.query(
        `INSERT INTO ${TPPF} (id_trainer_pokemon, feat_id) VALUES ($1, $2) RETURNING personaje_pokemon_feat_id`,
        [id_personaje_pokemon, Number(feat.feat_id)])
      const pfId = ins[0].personaje_pokemon_feat_id
      for (const b of (feat.bonos || [])) {
        await client.query(
          `INSERT INTO ${TPPFB}
             (personaje_pokemon_feat_bonus_personaje_pokemon_feat_id,
              personaje_pokemon_feat_bonus_type, personaje_pokemon_feat_bonus_llave, personaje_pokemon_feat_bonus_value)
           VALUES ($1, $2, $3, $4)`,
          [pfId, b.type ?? null, b.llave ?? null, b.value ?? null])
      }
    }
    await applyHpRoll(client, id_personaje_pokemon, hp.roll)
    await client.query(
      `UPDATE ${TPPI} SET personaje_pokemon_pending_improvement_applied = true
       WHERE personaje_pokemon_pending_improvement_id = $1`, [pend.id])
    return { ok: true, hp_roll: hp.roll }
  })
}

module.exports = { listPending, confirmMoves, confirmAsi }
