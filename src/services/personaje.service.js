const { query, transaction, SCHEMA } = require('../config/db')
const T   = `"${SCHEMA}"."personaje"`
const TS  = `"${SCHEMA}"."personaje_stats"`
const TSK = `"${SCHEMA}"."personaje_skill"`
const TEQ = `"${SCHEMA}"."personaje_equipo"`
const TD  = `"${SCHEMA}"."personaje_details"`
const TSKILLS = `"${SCHEMA}"."skills"`
const TUP = `"${SCHEMA}"."usuarios_partida"`

// Devuelve el id_usuarios_partida de la participación (user + partida)
const getParticipacion = async (id_partida, user_id) => {
  const { rows } = await query(
    `SELECT id_usuarios_partida FROM ${TUP} WHERE id_partida = $1 AND user_id = $2`,
    [id_partida, user_id]
  )
  return rows[0]?.id_usuarios_partida || null
}

// Personajes del usuario dentro de una partida
const findByPartidaUser = async (id_partida, user_id) => {
  const { rows } = await query(
    `SELECT p.*
     FROM ${T} p
     JOIN ${TUP} up ON up.id_usuarios_partida = p.id_usuario_partida
     WHERE up.id_partida = $1 AND up.user_id = $2
     ORDER BY p.id_personaje`,
    [id_partida, user_id]
  )
  return rows
}

const findById = async (id_personaje) => {
  const { rows } = await query(
    `SELECT p.*, s.*
     FROM ${T} p
     LEFT JOIN ${TS} s ON s.id_personaje = p.id_personaje
     WHERE p.id_personaje = $1`,
    [id_personaje]
  )
  return rows[0] || null
}

const ABIL = ['dex', 'str', 'con', 'int', 'wis', 'cha']
const norm = (s) => (s || '').toLowerCase().trim()

// Personaje con toda su información relacionada (para la hoja completa)
const findFullById = async (id_personaje) => {
  const { rows: pRows } = await query(
    `SELECT p.*, o.origin_name, b.background_name
     FROM ${T} p
     LEFT JOIN "${SCHEMA}"."origins"     o ON o.origin_id     = p.personaje_origin
     LEFT JOIN "${SCHEMA}"."backgrounds" b ON b.background_id = p.personaje_background
     WHERE p.id_personaje = $1`,
    [id_personaje]
  )
  const personaje = pRows[0]
  if (!personaje) return null

  const { rows: statsRows } = await query(`SELECT * FROM ${TS} WHERE id_personaje = $1`, [id_personaje])
  const { rows: skillRows } = await query(
    `SELECT s.skill_name, s.skill_related_ability, sk.personaje_skill_pref, sk.personaje_skill_expert
     FROM ${TSK} sk JOIN ${TSKILLS} s ON s.skill_id = sk.id_skill
     WHERE sk.id_personaje = $1 ORDER BY s.skill_name`,
    [id_personaje]
  )
  const { rows: equipoRows } = await query(
    `SELECT i.item_name, i.item_description, eq.personaje_equipo_cantidad AS cantidad
     FROM ${TEQ} eq JOIN "${SCHEMA}"."items" i ON i.item_id = eq.id_item
     WHERE eq.id_personaje = $1 ORDER BY eq.id_personaje_equipo`,
    [id_personaje]
  )
  const { rows: detRows } = await query(
    `SELECT nombre_personaje_detail, descripcion_personaje_detail
     FROM ${TD} WHERE id_personaje = $1 ORDER BY id_personaje_detail`,
    [id_personaje]
  )

  return {
    ...personaje,
    stats:   statsRows[0] || null,
    skills:  skillRows,
    equipo:  equipoRows,
    details: detRows,
  }
}

/**
 * Crea un personaje completo (personaje + stats + skills + equipo + details)
 * dentro de una transacción.
 */
const create = async (id_partida, user_id, data) => {
  const idUP = await getParticipacion(id_partida, user_id)
  if (!idUP) return null

  const base  = data.stats_base  || {}
  const bonus = data.stats_bonus || {}
  const hp    = Number(data.personaje_hp) || 0

  return transaction(async (client) => {
    // ── 1. personaje ──────────────────────────────────────────────
    const { rows: pRows } = await client.query(
      `INSERT INTO ${T} (
         nombre_personaje, id_usuario_partida, personaje_origin, personaje_background,
         personaje_level, personaje_hit_dice, personaje_hp, personaje_current_hp,
         saving_throw_prof, pokedollars_personaje, personaje_prof,
         personaje_ideales, personaje_falencias, personaje_conexiones
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        data.nombre_personaje ?? null,
        idUP,
        data.personaje_origin ?? null,
        data.personaje_background ?? null,
        data.personaje_level ?? 1,
        data.personaje_hit_dice ?? null,
        hp,
        hp,
        data.saving_throw_prof ?? null,
        Number(data.pokedollars) || 0,
        2, // personaje_prof: bono de proficiencia inicial (nivel 1)
        data.ideales ?? null,
        data.falencias ?? null,
        data.conexiones ?? null,
      ]
    )
    const personaje = pRows[0]
    const id_personaje = personaje.id_personaje

    // ── 2. personaje_stats ────────────────────────────────────────
    // prof por habilidad: solo la del saving throw va en true (ej. CHA)
    const profAbil = norm(data.saving_throw_prof) // 'cha'
    await client.query(
      `INSERT INTO ${TS} (
         id_personaje,
         personaje_dex, personaje_str, personaje_con, personaje_int, personaje_wis, personaje_cha,
         personaje_dex_bonus, personaje_str_bonus, personaje_con_bonus, personaje_int_bonus, personaje_wis_bonus, personaje_cha_bonus,
         personaje_stats_dex_prof, personaje_stats_str_prof, personaje_stats_con_prof,
         personaje_stats_int_prof, personaje_stats_wis_prof, personaje_stats_cha_prof
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
      [
        id_personaje,
        Number(base.personaje_dex) || 0, Number(base.personaje_str) || 0, Number(base.personaje_con) || 0,
        Number(base.personaje_int) || 0, Number(base.personaje_wis) || 0, Number(base.personaje_cha) || 0,
        Number(bonus.personaje_dex) || 0, Number(bonus.personaje_str) || 0, Number(bonus.personaje_con) || 0,
        Number(bonus.personaje_int) || 0, Number(bonus.personaje_wis) || 0, Number(bonus.personaje_cha) || 0,
        profAbil === 'dex', profAbil === 'str', profAbil === 'con',
        profAbil === 'int', profAbil === 'wis', profAbil === 'cha',
      ]
    )

    // ── 3. personaje_skill (todas las skills; pref=true las proficientes) ──
    const { rows: skills } = await client.query(`SELECT skill_id, skill_name FROM ${TSKILLS}`)
    const profSet = new Set((data.prof_skills || []).map(norm))
    for (const sk of skills) {
      const pref = profSet.has(norm(sk.skill_name))
      await client.query(
        `INSERT INTO ${TSK} (id_personaje, id_skill, personaje_skill_pref, personaje_skill_expert)
         VALUES ($1,$2,$3,false)`,
        [id_personaje, sk.skill_id, pref]
      )
    }

    // ── 4. personaje_equipo ───────────────────────────────────────
    for (const it of (data.equipo || [])) {
      if (!it || !it.id_item) continue
      await client.query(
        `INSERT INTO ${TEQ} (id_personaje, id_item, personaje_equipo_cantidad)
         VALUES ($1,$2,$3)`,
        [id_personaje, it.id_item, Number(it.cantidad) || 1]
      )
    }

    // ── 5. personaje_details ──────────────────────────────────────
    for (const d of (data.detalles || [])) {
      if (!d || (!d.tipo && !d.texto)) continue
      await client.query(
        `INSERT INTO ${TD} (nombre_personaje_detail, descripcion_personaje_detail, id_personaje)
         VALUES ($1,$2,$3)`,
        [d.tipo ?? null, d.texto ?? null, id_personaje]
      )
    }

    return personaje
  })
}

module.exports = { findByPartidaUser, findById, findFullById, create }
