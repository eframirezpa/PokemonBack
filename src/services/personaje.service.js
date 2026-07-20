const { query, transaction, SCHEMA } = require('../config/db')
const T   = `"${SCHEMA}"."personaje"`
const TS  = `"${SCHEMA}"."personaje_stats"`
const TSK = `"${SCHEMA}"."personaje_skill"`
const TEQ = `"${SCHEMA}"."personaje_equipo"`
const TD  = `"${SCHEMA}"."personaje_details"`
const TAR = `"${SCHEMA}"."personaje_armor"`
const TW  = `"${SCHEMA}"."personaje_weapon"`
const TPP = `"${SCHEMA}"."personaje_pokemon"`
const TSKILLS = `"${SCHEMA}"."skills"`
const TARMOR  = `"${SCHEMA}"."armor_types"`
const TWEAPON = `"${SCHEMA}"."weapon_types"`
const TPOKEDEX = `"${SCHEMA}"."pokemon"`
const TUP = `"${SCHEMA}"."usuarios_partida"`
const TPPM = `"${SCHEMA}"."personaje_pokemon_moves"`
const TPS  = `"${SCHEMA}"."pokemon_stats"`
const TPSK = `"${SCHEMA}"."pokemon_skills"`
const TNAT = `"${SCHEMA}"."natures"`
const TMOVES = `"${SCHEMA}"."moves"`
const TPPP = `"${SCHEMA}"."personaje_pokemon_pasiva"`
const TABIL = `"${SCHEMA}"."abilities"`
const TBONDS = `"${SCHEMA}"."bonds"`
const TPF   = `"${SCHEMA}"."personaje_feat"`
const TPFB  = `"${SCHEMA}"."personaje_feat_bonus"`
const TPAP  = `"${SCHEMA}"."personaje_armor_prof"`
const TFB   = `"${SCHEMA}"."feats_bonus"`
const TFEATS = `"${SCHEMA}"."feats"`

// Stats válidos para los bonos de tipo 'stat'
const STAT_KEYS = ['dex', 'str', 'con', 'int', 'wis', 'cha']
// Feat con manejo especial: Skilled (3 entre proficiencias de skill y textos de Tool Prof)
const FEAT_SKILLED = 10

// Analiza un feat_bonus de tipo 'stat'. Devuelve null si no es stat.
// modes: 'fixed' (llave fija), 'single' (elegir 1 entre options), 'distribute' (repartir puntos según patterns)
const analyzeStatBonus = (b) => {
  if ((b.type || '').toLowerCase() !== 'stat') return null
  const llave = (b.llave || '').toLowerCase().trim()
  const valor = (b.valor || '').trim()

  if (llave === 'any') {
    if (/or/i.test(valor)) {
      const patterns = valor.split(/or/i)
        .map(p => p.trim().split(',').map(n => parseInt(n, 10)).filter(n => !isNaN(n)).sort((a, c) => c - a))
        .filter(p => p.length)
      const total  = patterns[0] ? patterns[0].reduce((a, c) => a + c, 0) : 0
      const maxPer = patterns.length ? Math.max(...patterns.flat()) : 0
      return { mode: 'distribute', options: STAT_KEYS, patterns, total, maxPer }
    }
    return { mode: 'single', options: STAT_KEYS, value: parseInt(valor, 10) || 0 }
  }
  if (/or/i.test(llave)) {
    const options = llave.split(/or/i).map(s => s.trim()).filter(s => STAT_KEYS.includes(s))
    return { mode: 'single', options, value: parseInt(valor, 10) || 0 }
  }
  if (STAT_KEYS.includes(llave)) {
    return { mode: 'fixed', llave, value: parseInt(valor, 10) || 0 }
  }
  return null
}

// ¿La distribución elegida (valores) coincide con alguno de los patterns?
const matchesPattern = (values, patterns) => {
  const chosen = values.filter(v => v > 0).sort((a, c) => c - a)
  return patterns.some(p => p.length === chosen.length && p.every((v, i) => v === chosen[i]))
}

// Analiza un feat_bonus de tipo 'skill'. valor = 'prof' | 'expert'; llave = 'any' o el nombre de la skill.
// modes: 'choose' (elegir 1 skill), 'fixed' (skill de la llave)
const analyzeSkillBonus = (b) => {
  if ((b.type || '').toLowerCase() !== 'skill') return null
  const kind = (b.valor || '').toLowerCase()
  if (kind !== 'prof' && kind !== 'expert') return null
  return { mode: (b.llave || '').toLowerCase().trim() === 'any' ? 'choose' : 'fixed', kind }
}

// Evalúa un prerequisito de feat_bonus. ctx: { level, statTotal(key)→num, armorProfs:Set }
const prereqMet = (prereq, valor, ctx) => {
  const p = (prereq || '').toLowerCase().trim()
  if (!p) return true
  if (p === 'lvl') return (ctx.level || 0) >= (Number(valor) || 0)
  if (STAT_KEYS.includes(p)) return ctx.statTotal(p) >= (Number(valor) || 0)
  if (p === 'armor prof') return ctx.armorProfs.has((valor || '').toLowerCase().trim())
  return true // prereq desconocido → no bloquea
}

// Contexto del personaje para evaluar prerequisitos (nivel, stats totales, proficiencias de armadura)
const buildPrereqContext = async (id_personaje) => {
  const { rows: pr } = await query(`SELECT personaje_level, personaje_background FROM ${T} WHERE id_personaje = $1`, [id_personaje])
  const level = pr[0]?.personaje_level || 0
  const { rows: sRows } = await query(`SELECT * FROM ${TS} WHERE id_personaje = $1`, [id_personaje])
  const srow = sRows[0] || {}
  const { rows: fsRows } = await query(
    `SELECT pfb.personaje_feat_bonus_llave l, pfb.personaje_feat_bonus_value v
     FROM ${TPFB} pfb JOIN ${TPF} pf ON pf.personaje_feat_id = pfb.personaje_feat_bonus_personaje_feat_id
     WHERE pf.personaje_id = $1 AND lower(pfb.personaje_feat_bonus_type) = 'stat'`, [id_personaje]
  )
  const featStatAdd = {}
  for (const r of fsRows) { const k = (r.l || '').toLowerCase(); featStatAdd[k] = (featStatAdd[k] || 0) + (Number(r.v) || 0) }
  const statTotal = (k) => (Number(srow[`personaje_${k}`]) || 0) + (Number(srow[`personaje_${k}_bonus`]) || 0) + (featStatAdd[k] || 0)

  const { rows: apRows } = await query(`SELECT armor_prof FROM ${TPAP} WHERE id_personaje = $1`, [id_personaje])
  const armorProfs = new Set(apRows.map(r => (r.armor_prof || '').toLowerCase().trim()))
  if (pr[0]?.personaje_background) {
    const { rows: bg } = await query(
      `SELECT background_armor_proficiencies_value_1 v1, background_armor_proficiencies_value_2 v2,
              background_armor_proficiencies_value_3 v3, background_armor_proficiencies_value_4 v4
       FROM ${TBACKGROUNDS} WHERE background_id = $1`, [pr[0].personaje_background]
    )
    for (const v of [bg[0]?.v1, bg[0]?.v2, bg[0]?.v3, bg[0]?.v4]) if (v) armorProfs.add(v.toLowerCase().trim())
  }
  return { level, statTotal, armorProfs }
}

// Analiza un feat_bonus de tipo 'armor prof'. La llave puede traer 'and'/'or'.
// modes: 'direct' (1 registro), 'and' (varios registros), 'or' (elegir 1 entre options)
const analyzeArmorProfBonus = (b) => {
  if ((b.type || '').toLowerCase().trim() !== 'armor prof') return null
  const llave = (b.llave || '').trim()
  if (/\s+or\s+/i.test(llave))  return { mode: 'or',  options: llave.split(/\s+or\s+/i).map(s => s.trim()).filter(Boolean) }
  if (/\s+and\s+/i.test(llave)) return { mode: 'and', items:   llave.split(/\s+and\s+/i).map(s => s.trim()).filter(Boolean) }
  return { mode: 'direct', items: [llave] }
}

// Separador para unir varios textos capturados en personaje_feat_bonus_value (Unit Separator, no se puede teclear)
const TEXT_SEP = String.fromCharCode(31)
// Analiza un feat_bonus de tipo 'text'. valor = cantidad de cajas de texto a capturar.
const analyzeTextBonus = (b) => {
  if ((b.type || '').toLowerCase().trim() !== 'text') return null
  return { count: Math.max(1, parseInt(b.valor, 10) || 1) }
}

const TORIGINS = `"${SCHEMA}"."origins"`
const TBACKGROUNDS = `"${SCHEMA}"."backgrounds"`

// Devuelve el id_usuarios_partida de la participación (user + partida)
const getParticipacion = async (id_partida, user_id) => {
  const { rows } = await query(
    `SELECT id_usuarios_partida FROM ${TUP} WHERE id_partida = $1 AND user_id = $2`,
    [id_partida, user_id]
  )
  return rows[0]?.id_usuarios_partida || null
}

// Party: todos los personajes de una partida (con su user_id) + sus Pokémon del cinturón.
// Solo lectura, para el panel "Party".
const findParty = async (id_partida) => {
  const { rows: chars } = await query(
    `SELECT p.id_personaje, up.user_id, p.nombre_personaje,
            p.personaje_hp, p.personaje_current_hp,
            p.personaje_exahust_lvl, p.personaje_dsts, p.personaje_dstf,
            p.personaje_is_editable
     FROM ${T} p
     JOIN ${TUP} up ON up.id_usuarios_partida = p.id_usuario_partida
     WHERE up.id_partida = $1
     ORDER BY p.id_personaje`,
    [id_partida]
  )
  for (const c of chars) {
    const { rows: pks } = await query(
      `SELECT pp.id_personaje_pokemon, pp.pokemon_apodo, pp.pokemon_hp, pp.pokemon_current_hp,
              pp.personaje_pokemon_exahust_lvl, pp.personaje_pokemon_dsts, pp.personaje_pokemon_dstf,
              pp.pokemon_is_shiny,
              pk.pokemon_media_sprite, pk.pokemon_media_sprite_shiny, pk.pokemon_media_main
       FROM ${TPP} pp JOIN ${TPOKEDEX} pk ON pk.pokemon_id = pp.id_pokemon
       WHERE pp.id_personaje = $1 AND pp.pokemon_en_equipo = true
       ORDER BY pp.id_personaje_pokemon`,
      [c.id_personaje]
    )
    c.pokemons = pks.map(fixMedia)
  }
  return chars
}

// Actualiza campos de combate del personaje (HP actual, exhaust, dsts, dstf)
const updateCombate = async (id_personaje, { current_hp, exhaust_lvl, dsts, dstf }) => {
  const sets = [], params = []
  const add = (col, val) => { if (val !== undefined && val !== null) { params.push(val); sets.push(`${col} = $${params.length}`) } }
  add('personaje_current_hp', current_hp)
  add('personaje_exahust_lvl', exhaust_lvl)
  add('personaje_dsts', dsts)
  add('personaje_dstf', dstf)
  if (!sets.length) return null
  params.push(id_personaje)
  const { rows } = await query(
    `UPDATE ${T} SET ${sets.join(', ')} WHERE id_personaje = $${params.length} RETURNING *`, params
  )
  return rows[0] || null
}

// Actualiza campos de combate de un Pokémon del personaje
const updatePokemonCombate = async (id_personaje_pokemon, { current_hp, exhaust_lvl, dsts, dstf }) => {
  const sets = [], params = []
  const add = (col, val) => { if (val !== undefined && val !== null) { params.push(val); sets.push(`${col} = $${params.length}`) } }
  add('pokemon_current_hp', current_hp)
  add('personaje_pokemon_exahust_lvl', exhaust_lvl)
  add('personaje_pokemon_dsts', dsts)
  add('personaje_pokemon_dstf', dstf)
  if (!sets.length) return null
  params.push(id_personaje_pokemon)
  const { rows } = await query(
    `UPDATE ${TPP} SET ${sets.join(', ')} WHERE id_personaje_pokemon = $${params.length} RETURNING *`, params
  )
  return rows[0] || null
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

// ── Pokémon del personaje ────────────────────────────────────────
// Algunas medias (p. ej. pokemon_media_sprite_shiny) vienen como ruta relativa
// "/assets/...". Las convertimos a URL absoluta usando la base de una media
// absoluta de la misma fila.
const MEDIA_FIELDS = ['pokemon_media_main', 'pokemon_media_main_shiny', 'pokemon_media_sprite', 'pokemon_media_sprite_shiny']
const fixMedia = (row) => {
  if (!row) return row
  const abs = MEDIA_FIELDS.map(f => row[f]).find(u => u && u.startsWith('http') && u.includes('/assets'))
  const base = abs ? abs.split('/assets')[0] : ''
  if (base) for (const f of MEDIA_FIELDS) {
    if (row[f] && row[f].startsWith('/')) row[f] = base + row[f]
  }
  return row
}

const findPokemon = async (id_personaje, enEquipo = null) => {
  const params = [id_personaje]
  let cond = ''
  if (enEquipo !== null) { params.push(enEquipo); cond = ` AND pp.pokemon_en_equipo = $${params.length}` }
  const { rows } = await query(
    `SELECT pp.id_personaje_pokemon, pp.id_pokemon, pp.pokemon_apodo, pp.pokemon_level,
            pp.pokemon_en_equipo, pp.pokemon_is_shiny,
            pk.pokemon_name, pk.pokemon_media_sprite, pk.pokemon_media_sprite_shiny, pk.pokemon_media_main
     FROM ${TPP} pp
     JOIN ${TPOKEDEX} pk ON pk.pokemon_id = pp.id_pokemon
     WHERE pp.id_personaje = $1${cond}
     ORDER BY pp.id_personaje_pokemon`,
    params
  )
  return rows.map(fixMedia)
}

// Detalle completo de un Pokémon del personaje (tipo pokédex, con datos persistidos)
const findPokemonDetail = async (id_personaje_pokemon) => {
  const { rows } = await query(
    `SELECT pp.*, pk.pokemon_name, pk.pokemon_type_1, pk.pokemon_type_2,
            pk.pokemon_media_main, pk.pokemon_media_main_shiny, pk.pokemon_media_sprite,
            n.nature_name, n.nature_effect_increase, n.nature_effect_increase_value,
            n.nature_effect_decrease, n.nature_effect_decrease_value,
            b.bond_name, b.bond_description
     FROM ${TPP} pp
     JOIN ${TPOKEDEX} pk ON pk.pokemon_id = pp.id_pokemon
     LEFT JOIN ${TNAT} n ON n.nature_id = pp.personaje_pokemon_nature
     LEFT JOIN ${TBONDS} b ON b.bond_id = pp.personaje_pokemon_bond
     WHERE pp.id_personaje_pokemon = $1`,
    [id_personaje_pokemon]
  )
  const pp = rows[0]
  if (!pp) return null

  const { rows: statsRows } = await query(
    `SELECT * FROM ${TPS} WHERE id_personaje_pokemon = $1`, [id_personaje_pokemon]
  )
  const { rows: skills } = await query(
    `SELECT s.skill_name, s.skill_related_ability, ps.pokemon_skill_pref, ps.pokemon_skill_expert
     FROM ${TPSK} ps JOIN ${TSKILLS} s ON s.skill_id = ps.id_skill
     WHERE ps.id_personaje_pokemon = $1
     ORDER BY ps.id_pokemon_skills`,
    [id_personaje_pokemon]
  )
  const { rows: moves } = await query(
    `SELECT m.move_id, m.move_name, m.move_type, m.move_pp, m.move_time, m.move_range,
            m.move_duration, m.move_description, m.move_power_1, m.move_power_2, m.move_power_3,
            m.move_higher_levels, m.move_optional_rules, m.move_has_damage,
            m.move_damage_level_1, m.move_damage_level_5, m.move_damage_level_10, m.move_damage_level_17,
            m.move_damage_modifier, m.move_damage_type, m.move_attack_scope,
            m.move_save_attribute, m.move_save_dc, m.move_is_concentration
     FROM ${TPPM} pm JOIN ${TMOVES} m ON m.move_id = pm.personaje_pokemon_moves_move_id
     WHERE pm.personaje_pokemon_moves_personaje_pokemon_id = $1
     ORDER BY pm.personaje_pokemon_moves_id`,
    [id_personaje_pokemon]
  )
  const { rows: pasivas } = await query(
    `SELECT a.ability_id, a.ability_name, a.ability_description
     FROM ${TPPP} pv JOIN ${TABIL} a ON a.ability_id = pv.id_abilitie
     WHERE pv.id_personaje_pokemon = $1
     ORDER BY pv.id_personaje_pokemon_pasiva_id`,
    [id_personaje_pokemon]
  )
  return { ...fixMedia(pp), stats: statsRows[0] || null, skills, moves, pasivas }
}

// Marca/desmarca un Pokémon como "en el cinturón". Máximo 6 en el cinturón.
const setPokemonEnEquipo = async (id_personaje, id_personaje_pokemon, enEquipo) => {
  if (enEquipo) {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS c FROM ${TPP} WHERE id_personaje = $1 AND pokemon_en_equipo = true`,
      [id_personaje]
    )
    if (rows[0].c >= 6) return { full: true }
  }
  const { rows } = await query(
    `UPDATE ${TPP} SET pokemon_en_equipo = $1
     WHERE id_personaje_pokemon = $2 AND id_personaje = $3
     RETURNING *`,
    [enEquipo, id_personaje_pokemon, id_personaje]
  )
  return rows[0] || null
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
    `SELECT p.*, o.origin_name, o.origin_feat_id, b.background_name, b.background_feat_id,
            b.background_tool_proficiencies_name, b.background_tool_proficiencies_values,
            b.background_armor_proficiencies_value_1, b.background_armor_proficiencies_value_2,
            b.background_armor_proficiencies_value_3, b.background_armor_proficiencies_value_4
     FROM ${T} p
     LEFT JOIN "${SCHEMA}"."origins"     o ON o.origin_id     = p.personaje_origin
     LEFT JOIN "${SCHEMA}"."backgrounds" b ON b.background_id = p.personaje_background
     WHERE p.id_personaje = $1`,
    [id_personaje]
  )
  const personaje = pRows[0]
  if (!personaje) return null

  // Feats asociados al origen y al background (via origin_feat_id / background_feat_id)
  const featIds = [personaje.origin_feat_id, personaje.background_feat_id].filter(Boolean)
  let originFeat = null, backgroundFeat = null
  if (featIds.length) {
    const { rows: featRows } = await query(
      `SELECT * FROM "${SCHEMA}"."feats" WHERE feat_id = ANY($1)`, [featIds]
    )
    originFeat     = featRows.find(f => f.feat_id === personaje.origin_feat_id)     || null
    backgroundFeat = featRows.find(f => f.feat_id === personaje.background_feat_id) || null
  }

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
  const { rows: armorProfRows } = await query(
    `SELECT armor_prof FROM ${TPAP} WHERE id_personaje = $1 ORDER BY id_personaje_armor_prof`,
    [id_personaje]
  )
  const { rows: extraFeatRows } = await query(
    `SELECT pf.personaje_feat_id, pf.personaje_feat_is_available, f.*,
            COALESCE((
              SELECT json_agg(json_build_object(
                'type',  pfb.personaje_feat_bonus_type,
                'llave', pfb.personaje_feat_bonus_llave,
                'value', pfb.personaje_feat_bonus_value
              ) ORDER BY pfb.personaje_feat_bonus_id)
              FROM ${TPFB} pfb WHERE pfb.personaje_feat_bonus_personaje_feat_id = pf.personaje_feat_id
            ), '[]') AS bonos,
            COALESCE((
              SELECT json_agg(pap.armor_prof ORDER BY pap.id_personaje_armor_prof)
              FROM ${TPAP} pap WHERE pap.personaje_armor_prof_feat_id = pf.personaje_feat_id
            ), '[]') AS armor_profs,
            COALESCE((
              SELECT json_agg(json_build_object(
                'prereq', fb.feats_bonus_prerequisito,
                'valor',  fb.feats_bonus_prerequisito_valor
              ))
              FROM ${TFB} fb WHERE fb.id_feat = f.feat_id AND fb.feats_bonus_prerequisito IS NOT NULL
            ), '[]') AS prereqs
     FROM ${TPF} pf JOIN ${TFEATS} f ON f.feat_id = pf.feat_id
     WHERE pf.personaje_id = $1
     ORDER BY pf.personaje_feat_id`,
    [id_personaje]
  )

  return {
    ...personaje,
    stats:           statsRows[0] || null,
    skills:          skillRows,
    equipo:          equipoRows,
    details:         detRows,
    armor:           armorRows[0] || null,
    weapons:         weaponRows,
    origin_feat:     originFeat,
    background_feat: backgroundFeat,
    extra_feats:     extraFeatRows,
    armor_profs:     armorProfRows.map(r => r.armor_prof),
  }
}

// ── Feats extra del personaje (personaje_feat) ───────────────────
// Lista los feats agregados manualmente (con su detalle completo)
const findFeats = async (id_personaje) => {
  const { rows } = await query(
    `SELECT pf.personaje_feat_id, f.*
     FROM ${TPF} pf JOIN ${TFEATS} f ON f.feat_id = pf.feat_id
     WHERE pf.personaje_id = $1
     ORDER BY pf.personaje_feat_id`,
    [id_personaje]
  )
  return rows
}

// Agrega un feat al personaje. Solo feats tipo 'General' u 'Origin'.
// Si no es repetible, no puede estar ya asignado (origen, background o extra).
// Resuelve los feat_bonus y los guarda en personaje_feat_bonus (una fila por bono resuelto):
//   - stat fijo / healing / otros → se copian tal cual
//   - stat 'any' o 'x or y' → se resuelven con las elecciones del jugador (choices por índice)
// NO modifica personaje_stats. Devuelve { error } o el registro creado con el detalle del feat.
const addFeat = async (id_personaje, feat_id, choices = {}) => {
  const { rows: fRows } = await query(`SELECT * FROM ${TFEATS} WHERE feat_id = $1`, [feat_id])
  const feat = fRows[0]
  if (!feat) return { error: 'notfound' }
  if (!['General', 'Origin'].includes(feat.feat_type)) return { error: 'type' }

  if (Number(feat.feat_is_repeatable) !== 1) {
    const { rows: dup } = await query(
      `SELECT 1 FROM ${TPF} WHERE personaje_id = $1 AND feat_id = $2
       UNION
       SELECT 1 FROM ${T} p
         LEFT JOIN ${TORIGINS}     o ON o.origin_id     = p.personaje_origin
         LEFT JOIN ${TBACKGROUNDS} b ON b.background_id = p.personaje_background
        WHERE p.id_personaje = $1 AND (o.origin_feat_id = $2 OR b.background_feat_id = $2)
       LIMIT 1`,
      [id_personaje, feat_id]
    )
    if (dup.length) return { error: 'duplicate' }
  }

  // Bonos del feat → filas resueltas para personaje_feat_bonus
  const { rows: bonuses } = await query(
    `SELECT feats_bonus_type AS type, feats_bonus_llave AS llave, feats_bonus_valor AS valor,
            feats_bonus_prerequisito AS prereq, feats_bonus_prerequisito_valor AS prereq_valor
     FROM ${TFB} WHERE id_feat = $1 ORDER BY id_feats_bonus`,
    [feat_id]
  )

  // Prerequisitos: si alguno no se cumple, no se puede agregar el feat (regla todo-o-nada)
  if (bonuses.some(b => b.prereq)) {
    const ctx = await buildPrereqContext(id_personaje)
    if (!bonuses.every(b => prereqMet(b.prereq, b.prereq_valor, ctx))) return { error: 'prereq' }
  }
  // Catálogo de skills (para validar los elegidos), solo si hay bonos skill de llave 'any'
  const needsSkillCat = bonuses.some(b =>
    (b.type || '').toLowerCase() === 'skill' && ['prof', 'expert'].includes((b.valor || '').toLowerCase()) &&
    (b.llave || '').toLowerCase().trim() === 'any')
  let validSkills = null
  if (needsSkillCat) {
    const { rows: sr } = await query(`SELECT skill_name FROM ${TSKILLS}`)
    validSkills = new Set(sr.map(r => r.skill_name.toLowerCase()))
  }

  const rowsToInsert = [] // → personaje_feat_bonus
  const armorRows    = [] // → personaje_armor_prof
  for (let i = 0; i < bonuses.length; i++) {
    const b  = bonuses[i]
    const st = analyzeStatBonus(b)
    if (st) {
      if (st.mode === 'fixed') { rowsToInsert.push({ type: 'stat', llave: st.llave, value: String(st.value) }); continue }
      // single o distribute → requiere elección del jugador
      const chosen = choices[String(i)] ?? choices[i]
      if (!Array.isArray(chosen) || chosen.length === 0) return { error: 'choices' }
      const picks = chosen.map(c => ({ llave: (c.llave || '').toLowerCase(), value: parseInt(c.value, 10) || 0 }))
      if (picks.some(p => !st.options.includes(p.llave))) return { error: 'choices' }
      if (new Set(picks.map(p => p.llave)).size !== picks.length) return { error: 'choices' }
      if (st.mode === 'single') {
        if (picks.length !== 1 || picks[0].value !== st.value) return { error: 'choices' }
      } else { // distribute
        if (!matchesPattern(picks.map(p => p.value), st.patterns)) return { error: 'choices' }
      }
      for (const p of picks) rowsToInsert.push({ type: 'stat', llave: p.llave, value: String(p.value) })
      continue
    }

    const sk = analyzeSkillBonus(b)
    if (sk) {
      if (sk.mode === 'fixed') { rowsToInsert.push({ type: 'skill', llave: b.llave, value: sk.kind }); continue }
      // choose → elegir 1 skill válida
      const chosen = choices[String(i)] ?? choices[i]
      if (!Array.isArray(chosen) || chosen.length !== 1) return { error: 'choices' }
      const skillName = (chosen[0].llave || '').trim()
      if (!skillName || (validSkills && !validSkills.has(skillName.toLowerCase()))) return { error: 'choices' }
      rowsToInsert.push({ type: 'skill', llave: skillName, value: sk.kind })
      continue
    }

    const ap = analyzeArmorProfBonus(b)
    if (ap) {
      if (ap.mode === 'or') {
        const chosen = choices[String(i)] ?? choices[i]
        if (!Array.isArray(chosen) || chosen.length !== 1) return { error: 'choices' }
        const opt = (chosen[0].llave || '').trim()
        if (!opt || !ap.options.some(o => o.toLowerCase() === opt.toLowerCase())) return { error: 'choices' }
        armorRows.push(opt)
      } else {
        armorRows.push(...ap.items)
      }
      continue
    }

    const tx = analyzeTextBonus(b)
    if (tx) {
      const chosen = choices[String(i)] ?? choices[i]
      if (!Array.isArray(chosen) || chosen.length !== tx.count) return { error: 'choices' }
      const texts = chosen.map(c => (c.text ?? '').toString())
      rowsToInsert.push({ type: b.type, llave: b.llave, value: texts.join(TEXT_SEP) })
      continue
    }

    // Bonos sin type ni llave solo llevan un prerequisito → no se persisten
    if (!(b.type || '').trim() && !(b.llave || '').trim()) continue
    // healing / otros → copiar tal cual
    rowsToInsert.push({ type: b.type, llave: b.llave, value: b.valor })
  }

  // Manejo especial: Skilled (feat 10) — exactamente 3 entre proficiencias de skill y textos de 'Tool Prof'.
  // Skills → una fila por skill (prof); textos → una sola fila (llave 'Tool Prof') unida por el separador.
  if (Number(feat_id) === FEAT_SKILLED) {
    const sk = (choices && choices.skilled) || {}
    const skills = [...new Set((Array.isArray(sk.skills) ? sk.skills : []).map(s => (s || '').trim()).filter(Boolean))]
    const texts  = (Array.isArray(sk.texts) ? sk.texts : []).map(t => (t || '').toString().trim()).filter(Boolean)
    if (skills.length + texts.length !== 3) return { error: 'choices' }
    if (skills.length) {
      const { rows: valid } = await query(`SELECT skill_name FROM ${TSKILLS} WHERE lower(skill_name) = ANY($1)`, [skills.map(s => s.toLowerCase())])
      const validSet = new Set(valid.map(r => r.skill_name.toLowerCase()))
      if (skills.some(s => !validSet.has(s.toLowerCase()))) return { error: 'choices' }
      for (const s of skills) rowsToInsert.push({ type: 'skill', llave: s, value: 'prof' })
    }
    if (texts.length) rowsToInsert.push({ type: 'text', llave: 'Tool Prof', value: texts.join(TEXT_SEP) })
  }

  return transaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO ${TPF} (personaje_id, feat_id) VALUES ($1, $2) RETURNING personaje_feat_id`,
      [id_personaje, feat_id]
    )
    const pfId = rows[0].personaje_feat_id
    for (const r of rowsToInsert) {
      await client.query(
        `INSERT INTO ${TPFB}
           (personaje_feat_bonus_personaje_feat_id, personaje_feat_bonus_type, personaje_feat_bonus_llave, personaje_feat_bonus_value)
         VALUES ($1, $2, $3, $4)`,
        [pfId, r.type ?? null, r.llave ?? null, r.value ?? null]
      )
    }
    for (const a of armorRows) {
      await client.query(
        `INSERT INTO ${TPAP} (id_personaje, armor_prof, personaje_armor_prof_feat_id)
         VALUES ($1, $2, $3)`,
        [id_personaje, a, pfId]
      )
    }
    return { personaje_feat_id: pfId, bonos: rowsToInsert, armor_profs: armorRows, ...feat }
  })
}

// Marca un feat extra (personaje_feat) como disponible o no. Valida que sea del personaje.
const setFeatAvailable = async (id_personaje, personaje_feat_id, is_available) => {
  const { rows } = await query(
    `UPDATE ${TPF} SET personaje_feat_is_available = $1
     WHERE personaje_feat_id = $2 AND personaje_id = $3
     RETURNING personaje_feat_id`,
    [!!is_available, personaje_feat_id, id_personaje]
  )
  return rows[0] || null
}

// Elimina un feat extra del personaje (personaje_feat). Devuelve true si se borró.
const removeFeat = async (id_personaje, personaje_feat_id) => {
  const { rowCount } = await query(
    `DELETE FROM ${TPF} WHERE personaje_feat_id = $1 AND personaje_id = $2`,
    [personaje_feat_id, id_personaje]
  )
  return rowCount > 0
}

// Descuenta pokédollars al personaje. Requiere tener pokédollars suficientes (>= cantidad a gastar).
// Devuelve { error, pokedollars } o { pokedollars } con el nuevo saldo.
const spendPokedollars = async (id_personaje, cantidad) => {
  const amt = Math.max(0, Math.floor(Number(cantidad) || 0))
  const { rows } = await query(`SELECT pokedollars_personaje FROM ${T} WHERE id_personaje = $1`, [id_personaje])
  if (!rows[0]) return { error: 'notfound' }
  const actual = Number(rows[0].pokedollars_personaje) || 0
  if (actual < amt) return { error: 'insufficient', pokedollars: actual }
  const nuevo = actual - amt
  await query(`UPDATE ${T} SET pokedollars_personaje = $1 WHERE id_personaje = $2`, [nuevo, id_personaje])
  return { pokedollars: nuevo }
}

// Suma pokédollars al personaje. Devuelve { error } o { pokedollars } con el nuevo saldo.
const addPokedollars = async (id_personaje, cantidad) => {
  const amt = Math.max(0, Math.floor(Number(cantidad) || 0))
  const { rows } = await query(`SELECT pokedollars_personaje FROM ${T} WHERE id_personaje = $1`, [id_personaje])
  if (!rows[0]) return { error: 'notfound' }
  const nuevo = (Number(rows[0].pokedollars_personaje) || 0) + amt
  await query(`UPDATE ${T} SET pokedollars_personaje = $1 WHERE id_personaje = $2`, [nuevo, id_personaje])
  return { pokedollars: nuevo }
}

// Activa/desactiva la edición del personaje (personaje_is_editable)
const setEditable = async (id_personaje, is_editable) => {
  const { rows } = await query(
    `UPDATE ${T} SET personaje_is_editable = $1 WHERE id_personaje = $2
     RETURNING id_personaje, personaje_is_editable`,
    [!!is_editable, id_personaje]
  )
  return rows[0] || null
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
         personaje_pokelvls, personaje_ideales, personaje_falencias, personaje_conexiones,
         personaje_speed, personaje_hit_dice_left,
         personaje_exahust_lvl, personaje_dsts, personaje_dstf
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
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
        30, // personaje_speed inicial (ft)
        '1/1', // personaje_hit_dice_left inicial
        0, 0, 0, // personaje_exahust_lvl, personaje_dsts, personaje_dstf
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
    // Armadura por defecto (Regular Clothing, id 1) siempre presente y sin usar
    if (Number(data.id_armor) !== 1) {
      await client.query(
        `INSERT INTO ${TAR} (id_armor, id_personaje, personaje_armor_in_use)
         VALUES (1, $1, false)`,
        [id_personaje]
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

// Agrega un Pokémon (especie de la pokédex) a un personaje, con sus stats,
// skills y movimientos. Deriva la mayor parte de los datos desde la pokédex.
const addPokemon = async (id_personaje, { id_pokemon, apodo, genero, id_nature, id_bond, move_ids, is_shiny, id_abilitie }) => {
  const { rows: pkRows } = await query(`SELECT * FROM ${TPOKEDEX} WHERE pokemon_id = $1`, [id_pokemon])
  const pk = pkRows[0]
  if (!pk) return null

  // Ajuste de naturaleza: +valor a la ability que sube, valor (negativo) a la que baja
  const natureAdj = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }
  const id_nat = id_nature != null ? Number(id_nature) : null
  if (id_nat != null) {
    const { rows: nRows } = await query(`SELECT * FROM ${TNAT} WHERE nature_id = $1`, [id_nat])
    const n = nRows[0]
    if (n) {
      const inc = norm(n.nature_effect_increase), dec = norm(n.nature_effect_decrease)
      if (natureAdj[inc] !== undefined) natureAdj[inc] += Number(n.nature_effect_increase_value) || 0
      if (natureAdj[dec] !== undefined) natureAdj[dec] += Number(n.nature_effect_decrease_value) || 0
    }
  }

  const generoText = genero === 'F' ? 'Female' : genero === 'M' ? 'Male' : 'Sin género'
  const hp = Number(pk.pokemon_hit_points) || 0
  const hitDice = `1${pk.pokemon_hit_dice || ''}`               // ej. "1d6"
  const bond = id_bond ? Number(id_bond) : null                 // 0/undefined → null (FK)
  const splitLower = s => (s || '').split(',').map(norm).filter(Boolean)
  const savingSet = new Set(splitLower(pk.pokemon_saving_throws))

  return transaction(async (client) => {
    // ── 1. personaje_pokemon ──────────────────────────────────────
    const { rows: ppRows } = await client.query(
      `INSERT INTO ${TPP} (
         id_personaje, id_pokemon, pokemon_apodo, pokemon_hp, pokemon_current_hp,
         pokemon_en_equipo, pokemon_proficient, pokemon_initiative, pokemon_level,
         pokemon_hit_dice, pokemon_saving_throw_prof, pokemon_hit_dice_left,
         personaje_pokemon_ac, personaje_pokemon_nature, personaje_pokemon_stab, personaje_pokemon_bond,
         personaje_pokemon_speed1_name, personaje_pokemon_speed1_value,
         personaje_pokemon_speed2_name, personaje_pokemon_speed2_value,
         personaje_pokemon_speed3_name, personaje_pokemon_speed3_value,
         personaje_pokemon_speed4_name, personaje_pokemon_speed4_value,
         personaje_pokemon_genero, pokemon_is_shiny,
         pokemon_sense_1_name, pokemon_sense_1_value,
         pokemon_sense_2_name, pokemon_sense_2_value,
         personaje_pokemon_exahust_lvl, personaje_pokemon_dsts, personaje_pokemon_dstf
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33)
       RETURNING *`,
      [
        id_personaje, id_pokemon, apodo ?? pk.pokemon_name, hp, hp,
        true, 2, 3, 1,
        hitDice, pk.pokemon_saving_throws ?? null, '1/1',
        pk.pokemon_armor_class != null ? Number(pk.pokemon_armor_class) : null,
        id_nat, 2, bond,
        pk.pokemon_speed_1_name ?? null, pk.pokemon_speed_1_value ?? null,
        pk.pokemon_speed_2_name ?? null, pk.pokemon_speed_2_value ?? null,
        pk.pokemon_speed_3_name ?? null, pk.pokemon_speed_3_value ?? null,
        pk.pokemon_speed_4_name ?? null, pk.pokemon_speed_4_value ?? null,
        generoText, !!is_shiny,
        pk.pokemon_sense_1_name ?? null, pk.pokemon_sense_1_value ?? null,
        pk.pokemon_sense_2_name ?? null, pk.pokemon_sense_2_value ?? null,
        0, 0, 0, // personaje_pokemon_exahust_lvl, personaje_pokemon_dsts, personaje_pokemon_dstf
      ]
    )
    const pp = ppRows[0]
    const id_pp = pp.id_personaje_pokemon

    // ── 2. pokemon_stats (base = pokédex, bonus = naturaleza) ─────
    const base = k => Number(pk[`pokemon_${k}`]) || 0
    await client.query(
      `INSERT INTO ${TPS} (
         id_personaje_pokemon,
         pokemon_dex, pokemon_str, pokemon_con, pokemon_int, pokemon_wis, pokemon_cha,
         pokemon_dex_bonus, pokemon_str_bonus, pokemon_con_bonus, pokemon_int_bonus, pokemon_wis_bonus, pokemon_cha_bonus,
         pokemon_stats_dex_prof, pokemon_stats_str_prof, pokemon_stats_con_prof,
         pokemon_stats_int_prof, pokemon_stats_wis_prof, pokemon_stats_cha_prof
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
      [
        id_pp,
        base('dex'), base('str'), base('con'), base('int'), base('wis'), base('cha'),
        natureAdj.dex, natureAdj.str, natureAdj.con, natureAdj.int, natureAdj.wis, natureAdj.cha,
        savingSet.has('dex'), savingSet.has('str'), savingSet.has('con'),
        savingSet.has('int'), savingSet.has('wis'), savingSet.has('cha'),
      ]
    )

    // ── 3. pokemon_skills (todas; pref = las proficientes de la pokédex) ──
    const { rows: skills } = await client.query(`SELECT skill_id, skill_name FROM ${TSKILLS}`)
    const profSet = new Set(splitLower(pk.pokemon_proficient_skills))
    for (const sk of skills) {
      await client.query(
        `INSERT INTO ${TPSK} (id_personaje_pokemon, id_skill, pokemon_skill_pref, pokemon_skill_expert)
         VALUES ($1,$2,$3,false)`,
        [id_pp, sk.skill_id, profSet.has(norm(sk.skill_name))]
      )
    }

    // ── 4. personaje_pokemon_moves ────────────────────────────────
    const uniqMoves = [...new Set((move_ids || []).map(Number).filter(Boolean))]
    for (const mid of uniqMoves) {
      await client.query(
        `INSERT INTO ${TPPM} (personaje_pokemon_moves_move_id, personaje_pokemon_moves_personaje_pokemon_id)
         VALUES ($1,$2)`,
        [mid, id_pp]
      )
    }

    // ── 5. Pasiva (habilidad) seleccionada ────────────────────────
    if (id_abilitie) {
      await client.query(
        `INSERT INTO ${TPPP} (id_abilitie, id_personaje_pokemon) VALUES ($1, $2)`,
        [Number(id_abilitie), id_pp]
      )
    }

    return pp
  })
}

module.exports = {
  findByPartidaUser, findParty, findById, findFullById,
  updateCombate, updatePokemonCombate,
  findEquipo, addEquipo, updateEquipoCantidad,
  findArmor, addArmor, setArmorInUse,
  findWeapon, addWeapon, setWeaponInUse,
  findPokemon, findPokemonDetail, setPokemonEnEquipo, addPokemon,
  findFeats, addFeat, removeFeat, setFeatAvailable, setEditable, spendPokedollars, addPokedollars,
  create,
}
