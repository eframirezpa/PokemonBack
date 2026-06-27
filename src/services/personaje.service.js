const { query, transaction, SCHEMA } = require('../config/db')
const T   = `"${SCHEMA}"."personaje"`
const TS  = `"${SCHEMA}"."personaje_stats"`
const TSK = `"${SCHEMA}"."personaje_skill"`
const TEQ = `"${SCHEMA}"."personaje_equipo"`
const TD  = `"${SCHEMA}"."personaje_details"`
const TAR = `"${SCHEMA}"."personaje_armor"`
const TW  = `"${SCHEMA}"."personaje_weapon"`
const TSKILLS = `"${SCHEMA}"."skills"`
const TARMOR  = `"${SCHEMA}"."armor_types"`
const TWEAPON = `"${SCHEMA}"."weapon_types"`
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

// ── Armaduras del personaje ──────────────────────────────────────
const computeArmorAC = (armor, dexMod) => {
  let ac = armor.armor_type_base_ac || 0
  if (armor.armor_type_uses_dex_modifier === 1) {
    const max = armor.armor_type_max_dex_modifier
    ac += (max != null) ? Math.min(dexMod, max) : dexMod
  }
  if (armor.armor_type_ac_bonus != null) ac += armor.armor_type_ac_bonus
  return ac
}

const findArmor = async (id_personaje) => {
  const { rows } = await query(
    `SELECT pa.id_personaje_armor, pa.personaje_armor_in_use, a.*
     FROM ${TAR} pa JOIN ${TARMOR} a ON a.armor_type_id = pa.id_armor
     WHERE pa.id_personaje = $1
     ORDER BY pa.id_personaje_armor`,
    [id_personaje]
  )
  return rows
}

const addArmor = async (id_personaje, id_armor) => {
  const { rows } = await query(
    `INSERT INTO ${TAR} (id_armor, id_personaje, personaje_armor_in_use)
     VALUES ($1, $2, false) RETURNING *`,
    [id_armor, id_personaje]
  )
  return rows[0]
}

// Marca/desmarca una armadura como en uso (solo una activa) y recalcula el AC
const setArmorInUse = async (id_personaje, id_personaje_armor, in_use) => {
  return transaction(async (client) => {
    if (in_use) {
      await client.query(`UPDATE ${TAR} SET personaje_armor_in_use = false WHERE id_personaje = $1`, [id_personaje])
      await client.query(`UPDATE ${TAR} SET personaje_armor_in_use = true WHERE id_personaje_armor = $1`, [id_personaje_armor])
    } else {
      await client.query(`UPDATE ${TAR} SET personaje_armor_in_use = false WHERE id_personaje_armor = $1`, [id_personaje_armor])
    }
    // Recalcular AC con la armadura en uso (si hay)
    const { rows: ar } = await client.query(
      `SELECT a.* FROM ${TAR} pa JOIN ${TARMOR} a ON a.armor_type_id = pa.id_armor
       WHERE pa.id_personaje = $1 AND pa.personaje_armor_in_use = true LIMIT 1`,
      [id_personaje]
    )
    let ac = null
    if (ar[0]) {
      const { rows: st } = await client.query(
        `SELECT personaje_dex, personaje_dex_bonus FROM ${TS} WHERE id_personaje = $1`, [id_personaje]
      )
      const dexFinal = (st[0]?.personaje_dex || 0) + (st[0]?.personaje_dex_bonus || 0)
      ac = computeArmorAC(ar[0], Math.floor((dexFinal - 10) / 2))
    }
    await client.query(`UPDATE ${T} SET personaje_ac = $1 WHERE id_personaje = $2`, [ac, id_personaje])
    return { id_personaje_armor, personaje_armor_in_use: in_use, personaje_ac: ac }
  })
}

// ── Armas del personaje ──────────────────────────────────────────
const isOneHanded = (handUse) => (handUse || '').toLowerCase().includes('one-handed')

const findWeapon = async (id_personaje) => {
  const { rows } = await query(
    `SELECT pw.id_personaje_weapon, pw.personaje_weapon_in_use, w.*
     FROM ${TW} pw JOIN ${TWEAPON} w ON w.weapon_type_id = pw.id_weapon
     WHERE pw.id_personaje = $1
     ORDER BY pw.id_personaje_weapon`,
    [id_personaje]
  )
  return rows
}

const addWeapon = async (id_personaje, id_weapon) => {
  const { rows } = await query(
    `INSERT INTO ${TW} (id_weapon, id_personaje, personaje_weapon_in_use)
     VALUES ($1, $2, false) RETURNING *`,
    [id_weapon, id_personaje]
  )
  return rows[0]
}

// Equipar/desequipar: 2 armas si son one-handed, 1 si no
const setWeaponInUse = async (id_personaje, id_personaje_weapon, in_use) => {
  return transaction(async (client) => {
    if (!in_use) {
      await client.query(`UPDATE ${TW} SET personaje_weapon_in_use = false WHERE id_personaje_weapon = $1`, [id_personaje_weapon])
      return { applied: true, in_use: false }
    }
    const { rows: tgt } = await client.query(
      `SELECT w.weapon_type_hand_use FROM ${TW} pw JOIN ${TWEAPON} w ON w.weapon_type_id = pw.id_weapon
       WHERE pw.id_personaje_weapon = $1`, [id_personaje_weapon]
    )
    if (!tgt[0]) return { applied: false, reason: 'notfound' }
    const targetOneHanded = isOneHanded(tgt[0].weapon_type_hand_use)

    const { rows: inUse } = await client.query(
      `SELECT pw.id_personaje_weapon, w.weapon_type_hand_use
       FROM ${TW} pw JOIN ${TWEAPON} w ON w.weapon_type_id = pw.id_weapon
       WHERE pw.id_personaje = $1 AND pw.personaje_weapon_in_use = true AND pw.id_personaje_weapon <> $2`,
      [id_personaje, id_personaje_weapon]
    )

    if (!targetOneHanded) {
      // two-handed: solo esta
      await client.query(`UPDATE ${TW} SET personaje_weapon_in_use = false WHERE id_personaje = $1`, [id_personaje])
      await client.query(`UPDATE ${TW} SET personaje_weapon_in_use = true WHERE id_personaje_weapon = $1`, [id_personaje_weapon])
      return { applied: true, in_use: true }
    }

    // one-handed: máximo 2, las otras en uso deben ser one-handed
    const oneHandedInUse = inUse.filter(w => isOneHanded(w.weapon_type_hand_use))
    if (oneHandedInUse.length >= 2) return { applied: false, reason: 'max' }

    const twoHandedIds = inUse.filter(w => !isOneHanded(w.weapon_type_hand_use)).map(w => w.id_personaje_weapon)
    if (twoHandedIds.length) {
      await client.query(`UPDATE ${TW} SET personaje_weapon_in_use = false WHERE id_personaje_weapon = ANY($1::int[])`, [twoHandedIds])
    }
    await client.query(`UPDATE ${TW} SET personaje_weapon_in_use = true WHERE id_personaje_weapon = $1`, [id_personaje_weapon])
    return { applied: true, in_use: true }
  })
}

// Items (mochila) del personaje con info del item
const findEquipo = async (id_personaje) => {
  const { rows } = await query(
    `SELECT eq.id_personaje_equipo, eq.id_item, eq.personaje_equipo_cantidad AS cantidad,
            i.item_name, i.item_type, i.item_description, i.item_cost
     FROM ${TEQ} eq
     JOIN "${SCHEMA}"."items" i ON i.item_id = eq.id_item
     WHERE eq.id_personaje = $1
     ORDER BY i.item_name`,
    [id_personaje]
  )
  return rows
}

// Agrega un item a la mochila (suma a la cantidad si ya existe)
const addEquipo = async (id_personaje, id_item, cantidad) => {
  const c = Math.max(1, Number(cantidad) || 1)
  const { rows: ex } = await query(
    `SELECT id_personaje_equipo, personaje_equipo_cantidad FROM ${TEQ}
     WHERE id_personaje = $1 AND id_item = $2`,
    [id_personaje, id_item]
  )
  if (ex[0]) {
    const { rows } = await query(
      `UPDATE ${TEQ} SET personaje_equipo_cantidad = $1 WHERE id_personaje_equipo = $2 RETURNING *`,
      [ex[0].personaje_equipo_cantidad + c, ex[0].id_personaje_equipo]
    )
    return rows[0]
  }
  const { rows } = await query(
    `INSERT INTO ${TEQ} (id_personaje, id_item, personaje_equipo_cantidad)
     VALUES ($1, $2, $3) RETURNING *`,
    [id_personaje, id_item, c]
  )
  return rows[0]
}

// Actualiza la cantidad de un item (no permite negativos)
const updateEquipoCantidad = async (id_personaje_equipo, cantidad) => {
  const c = Math.max(0, Number(cantidad) || 0)
  const { rows } = await query(
    `UPDATE ${TEQ} SET personaje_equipo_cantidad = $1 WHERE id_personaje_equipo = $2 RETURNING *`,
    [c, id_personaje_equipo]
  )
  return rows[0] || null
}

// Personaje con toda su información relacionada (para la hoja completa)
const findFullById = async (id_personaje) => {
  const { rows: pRows } = await query(
    `SELECT p.*, o.origin_name, b.background_name,
            b.background_tool_proficiencies_name, b.background_tool_proficiencies_values
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
  const { rows: armorRows } = await query(
    `SELECT a.* FROM ${TAR} pa
     JOIN ${TARMOR} a ON a.armor_type_id = pa.id_armor
     WHERE pa.id_personaje = $1 AND pa.personaje_armor_in_use = true
     LIMIT 1`,
    [id_personaje]
  )
  const { rows: weaponRows } = await query(
    `SELECT w.* FROM ${TW} pw
     JOIN ${TWEAPON} w ON w.weapon_type_id = pw.id_weapon
     WHERE pw.id_personaje = $1 AND pw.personaje_weapon_in_use = true
     ORDER BY pw.id_personaje_weapon`,
    [id_personaje]
  )

  return {
    ...personaje,
    stats:   statsRows[0] || null,
    skills:  skillRows,
    equipo:  equipoRows,
    details: detRows,
    armor:   armorRows[0] || null,
    weapons: weaponRows,
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
         saving_throw_prof, pokedollars_personaje, personaje_prof, personaje_ac,
         personaje_pokelvls, personaje_ideales, personaje_falencias, personaje_conexiones
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
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
        data.personaje_ac != null ? Number(data.personaje_ac) : null,
        '1/1', // personaje_pokelvls inicial
        data.ideales ?? null,
        data.falencias ?? null,
        data.conexiones ?? null,
      ]
    )
    const personaje = pRows[0]
    const id_personaje = personaje.id_personaje

    // ── Armadura equipada ─────────────────────────────────────────
    if (data.id_armor) {
      await client.query(
        `INSERT INTO ${TAR} (id_armor, id_personaje, personaje_armor_in_use)
         VALUES ($1, $2, true)`,
        [data.id_armor, id_personaje]
      )
    }

    // ── Arma equipada ─────────────────────────────────────────────
    if (data.id_weapon) {
      await client.query(
        `INSERT INTO ${TW} (id_weapon, id_personaje, personaje_weapon_in_use)
         VALUES ($1, $2, true)`,
        [data.id_weapon, id_personaje]
      )
    }

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

module.exports = {
  findByPartidaUser, findById, findFullById,
  findEquipo, addEquipo, updateEquipoCantidad,
  findArmor, addArmor, setArmorInUse,
  findWeapon, addWeapon, setWeaponInUse,
  create,
}
