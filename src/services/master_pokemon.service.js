const { query, transaction, SCHEMA } = require('../config/db')

// Tablas del master (copia de las de personaje_pokemon, atadas al usuario master)
const TMP  = `"${SCHEMA}"."master_pokemon"`
const TMPS = `"${SCHEMA}"."master_pokemon_stats"`
const TMPSK = `"${SCHEMA}"."master_pokemon_skills"`
const TMPM = `"${SCHEMA}"."master_pokemon_moves"`
const TMPP = `"${SCHEMA}"."master_pokemon_pasiva"`
// Catálogos compartidos
const TPOKEDEX = `"${SCHEMA}"."pokemon"`
const TPTYPES  = `"${SCHEMA}"."pokemon_types"`
const TSKILLS  = `"${SCHEMA}"."skills"`
const TNAT     = `"${SCHEMA}"."natures"`
const TMOVES   = `"${SCHEMA}"."moves"`
const TABIL    = `"${SCHEMA}"."abilities"`
const TBONDS   = `"${SCHEMA}"."bonds"`

const norm = (s) => (s || '').toLowerCase().trim()

// Ajuste de naturaleza: +valor a la ability que sube, valor (negativo) a la que baja
const computeNatureAdj = async (id_nat) => {
  const adj = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }
  if (id_nat == null) return adj
  const { rows } = await query(`SELECT * FROM ${TNAT} WHERE nature_id = $1`, [id_nat])
  const n = rows[0]
  if (n) {
    const inc = norm(n.nature_effect_increase), dec = norm(n.nature_effect_decrease)
    if (adj[inc] !== undefined) adj[inc] += Number(n.nature_effect_increase_value) || 0
    if (adj[dec] !== undefined) adj[dec] += Number(n.nature_effect_decrease_value) || 0
  }
  return adj
}
const generoTextOf = (g) => g === 'F' ? 'Female' : g === 'M' ? 'Male' : 'Sin género'

// Reescribe las URLs relativas de media a absolutas (igual que en personaje.service)
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

// Lista de Pokémon del master (opcionalmente filtrando por cinturón)
const findPokemon = async (id_master, enEquipo = null) => {
  const params = [id_master]
  let cond = ''
  if (enEquipo !== null) { params.push(enEquipo); cond = ` AND mp.pokemon_en_equipo = $${params.length}` }
  const { rows } = await query(
    `SELECT mp.id_master_pokemon, mp.id_pokemon, mp.pokemon_apodo, mp.pokemon_level,
            mp.pokemon_en_equipo, mp.pokemon_is_shiny, mp.personaje_pokemon_is_in_game,
            mp.personaje_pokemon_type_1, mp.personaje_pokemon_type_2,
            t1.pokemon_types_name AS type_1_name, t2.pokemon_types_name AS type_2_name,
            pk.pokemon_name, pk.pokemon_media_sprite, pk.pokemon_media_sprite_shiny,
            pk.pokemon_media_main, pk.pokemon_media_main_shiny
     FROM ${TMP} mp
     JOIN ${TPOKEDEX} pk ON pk.pokemon_id = mp.id_pokemon
     LEFT JOIN ${TPTYPES} t1 ON t1.pokemon_types_id = mp.personaje_pokemon_type_1
     LEFT JOIN ${TPTYPES} t2 ON t2.pokemon_types_id = mp.personaje_pokemon_type_2
     WHERE mp.id_master = $1${cond}
     ORDER BY mp.id_master_pokemon`,
    params
  )
  return rows.map(fixMedia)
}

// Detalle completo de un Pokémon del master (tipo pokédex, con datos persistidos)
const findPokemonDetail = async (id_master_pokemon) => {
  const { rows } = await query(
    `SELECT mp.*, pk.pokemon_name, pk.pokemon_type_1, pk.pokemon_type_2, pk.pokemon_gender,
            pk.pokemon_media_main, pk.pokemon_media_main_shiny, pk.pokemon_media_sprite,
            n.nature_name, n.nature_effect_increase, n.nature_effect_increase_value,
            n.nature_effect_decrease, n.nature_effect_decrease_value,
            b.bond_name, b.bond_description
     FROM ${TMP} mp
     JOIN ${TPOKEDEX} pk ON pk.pokemon_id = mp.id_pokemon
     LEFT JOIN ${TNAT} n ON n.nature_id = mp.personaje_pokemon_nature
     LEFT JOIN ${TBONDS} b ON b.bond_id = mp.personaje_pokemon_bond
     WHERE mp.id_master_pokemon = $1`,
    [id_master_pokemon]
  )
  const mp = rows[0]
  if (!mp) return null

  const { rows: statsRows } = await query(
    `SELECT * FROM ${TMPS} WHERE id_master_pokemon = $1`, [id_master_pokemon]
  )
  const { rows: skills } = await query(
    `SELECT s.skill_id, s.skill_name, s.skill_related_ability, ms.pokemon_skill_pref, ms.pokemon_skill_expert
     FROM ${TMPSK} ms JOIN ${TSKILLS} s ON s.skill_id = ms.id_skill
     WHERE ms.id_master_pokemon = $1
     ORDER BY ms.id_master_pokemon_skills`,
    [id_master_pokemon]
  )
  const { rows: moves } = await query(
    `SELECT m.move_id, m.move_name, m.move_type, m.move_pp, m.move_time, m.move_range,
            m.move_duration, m.move_description, m.move_power_1, m.move_power_2, m.move_power_3,
            m.move_higher_levels, m.move_optional_rules, m.move_has_damage,
            m.move_damage_level_1, m.move_damage_level_5, m.move_damage_level_10, m.move_damage_level_17,
            m.move_damage_modifier, m.move_damage_type, m.move_attack_scope,
            m.move_save_attribute, m.move_save_dc, m.move_is_concentration
     FROM ${TMPM} pm JOIN ${TMOVES} m ON m.move_id = pm.master_pokemon_moves_move_id
     WHERE pm.master_pokemon_moves_master_pokemon_id = $1
     ORDER BY pm.master_pokemon_moves_id`,
    [id_master_pokemon]
  )
  const { rows: pasivas } = await query(
    `SELECT a.ability_id, a.ability_name, a.ability_description
     FROM ${TMPP} pv JOIN ${TABIL} a ON a.ability_id = pv.id_abilitie
     WHERE pv.id_master_pokemon = $1
     ORDER BY pv.id_master_pokemon_pasiva_id`,
    [id_master_pokemon]
  )
  return { ...fixMedia(mp), stats: statsRows[0] || null, skills, moves, pasivas }
}

// Actualiza campos de combate de un Pokémon del master (HP actual / exhaust / dsts / dstf)
const updatePokemonCombate = async (id_master_pokemon, { current_hp, exhaust_lvl, dsts, dstf }) => {
  const sets = [], params = []
  const add = (col, val) => { if (val !== undefined && val !== null) { params.push(val); sets.push(`${col} = $${params.length}`) } }
  add('pokemon_current_hp', current_hp)
  add('personaje_pokemon_exahust_lvl', exhaust_lvl)
  add('personaje_pokemon_dsts', dsts)
  add('personaje_pokemon_dstf', dstf)
  if (!sets.length) return null
  params.push(id_master_pokemon)
  const { rows } = await query(
    `UPDATE ${TMP} SET ${sets.join(', ')} WHERE id_master_pokemon = $${params.length} RETURNING *`, params
  )
  return rows[0] || null
}

// Marca/desmarca un Pokémon del master como "en el cinturón". Máximo 6.
const setPokemonEnEquipo = async (id_master, id_master_pokemon, enEquipo) => {
  if (enEquipo) {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS c FROM ${TMP} WHERE id_master = $1 AND pokemon_en_equipo = true`,
      [id_master]
    )
    if (rows[0].c >= 6) return { full: true }
  }
  // Al sacar del cinturón, también deja de estar invocado
  const extra = enEquipo ? '' : ', personaje_pokemon_is_in_game = false'
  const { rows } = await query(
    `UPDATE ${TMP} SET pokemon_en_equipo = $1${extra}
     WHERE id_master_pokemon = $2 AND id_master = $3
     RETURNING *`,
    [enEquipo, id_master_pokemon, id_master]
  )
  return rows[0] || null
}

// Marca (o desmarca) el Pokémon invocado. Solo uno puede estar en juego a la vez.
const setPokemonEnJuego = async (id_master, id_master_pokemon, enJuego) => {
  return transaction(async (client) => {
    if (enJuego) {
      await client.query(
        `UPDATE ${TMP} SET personaje_pokemon_is_in_game = false
         WHERE id_master = $1 AND personaje_pokemon_is_in_game = true`,
        [id_master]
      )
    }
    const { rows } = await client.query(
      `UPDATE ${TMP} SET personaje_pokemon_is_in_game = $1
       WHERE id_master_pokemon = $2 AND id_master = $3
       RETURNING *`,
      [enJuego, id_master_pokemon, id_master]
    )
    return rows[0] || null
  })
}

// Agrega un Pokémon (especie de la pokédex) al master, con stats, skills, movimientos y pasiva.
// `overrides` opcionales (usados por el creador del master): type_1, type_2 (ids),
// hp, stats {dex,str,...} (base) y skills [{ id_skill, pref, expert }]. Lo no provisto
// se deriva de la pokédex, igual que en la creación del jugador.
const addPokemon = async (id_master, { id_pokemon, apodo, genero, id_nature, id_bond, move_ids, is_shiny, id_abilitie, type_1, type_2, hp: hpOverride, stats: statsOverride, skills: skillsOverride }) => {
  const { rows: pkRows } = await query(`SELECT * FROM ${TPOKEDEX} WHERE pokemon_id = $1`, [id_pokemon])
  const pk = pkRows[0]
  if (!pk) return null

  const id_nat = id_nature != null ? Number(id_nature) : null
  const natureAdj = await computeNatureAdj(id_nat)

  // Tipos del pokémon padre (por nombre en la pokédex) → id en pokemon_types
  const typeId = async (name) => {
    if (!name) return null
    const { rows } = await query(
      `SELECT pokemon_types_id FROM ${TPTYPES} WHERE lower(trim(pokemon_types_name)) = lower(trim($1))`, [name])
    return rows[0]?.pokemon_types_id ?? null
  }
  // Tipos: overrides del creador o los derivados de la pokédex
  const type1Id = type_1 !== undefined ? (type_1 != null ? Number(type_1) : null) : await typeId(pk.pokemon_type_1)
  const type2Id = type_2 !== undefined ? (type_2 != null ? Number(type_2) : null) : await typeId(pk.pokemon_type_2)

  const generoText = generoTextOf(genero)
  const hp = hpOverride != null ? Number(hpOverride) : (Number(pk.pokemon_hit_points) || 0)
  const level = Number(pk.pokemon_min_level) || 1
  const hitDice = `1${pk.pokemon_hit_dice || ''}`
  const bond = id_bond ? Number(id_bond) : null
  const splitLower = s => (s || '').split(',').map(norm).filter(Boolean)
  const savingSet = new Set(splitLower(pk.pokemon_saving_throws))

  return transaction(async (client) => {
    // ── 1. master_pokemon ─────────────────────────────────────────
    const { rows: mpRows } = await client.query(
      `INSERT INTO ${TMP} (
         id_master, id_pokemon, pokemon_apodo, pokemon_hp, pokemon_current_hp,
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
         personaje_pokemon_exahust_lvl, personaje_pokemon_dsts, personaje_pokemon_dstf,
         personaje_pokemon_type_1, personaje_pokemon_type_2
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35)
       RETURNING *`,
      [
        id_master, id_pokemon, apodo ?? pk.pokemon_name, hp, hp,
        true, 2, 3, level,
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
        0, 0, 0,
        type1Id, type2Id,
      ]
    )
    const mp = mpRows[0]
    const id_mp = mp.id_master_pokemon

    // ── 2. master_pokemon_stats (base = override o pokédex, bonus = naturaleza) ──
    const base = k => (statsOverride && statsOverride[k] != null) ? Number(statsOverride[k]) : (Number(pk[`pokemon_${k}`]) || 0)
    await client.query(
      `INSERT INTO ${TMPS} (
         id_master_pokemon,
         pokemon_dex, pokemon_str, pokemon_con, pokemon_int, pokemon_wis, pokemon_cha,
         pokemon_dex_bonus, pokemon_str_bonus, pokemon_con_bonus, pokemon_int_bonus, pokemon_wis_bonus, pokemon_cha_bonus,
         pokemon_stats_dex_prof, pokemon_stats_str_prof, pokemon_stats_con_prof,
         pokemon_stats_int_prof, pokemon_stats_wis_prof, pokemon_stats_cha_prof
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
      [
        id_mp,
        base('dex'), base('str'), base('con'), base('int'), base('wis'), base('cha'),
        natureAdj.dex, natureAdj.str, natureAdj.con, natureAdj.int, natureAdj.wis, natureAdj.cha,
        savingSet.has('dex'), savingSet.has('str'), savingSet.has('con'),
        savingSet.has('int'), savingSet.has('wis'), savingSet.has('cha'),
      ]
    )

    // ── 3. master_pokemon_skills (override del creador o proficiencias de la pokédex) ──
    const { rows: skills } = await client.query(`SELECT skill_id, skill_name FROM ${TSKILLS}`)
    // Mapa id_skill → {pref, expert} cuando el creador envía skills; si no, deriva de la pokédex
    const skillMap = Array.isArray(skillsOverride)
      ? new Map(skillsOverride.map(s => [Number(s.id_skill), { pref: !!s.pref, expert: !!s.expert }]))
      : null
    const profSet = new Set(splitLower(pk.pokemon_proficient_skills))
    for (const sk of skills) {
      // Con override, un skill ausente del mapa queda sin proficiencia (no cae a la pokédex)
      const ov = skillMap ? (skillMap.get(sk.skill_id) || { pref: false, expert: false }) : null
      const pref   = ov ? ov.pref   : profSet.has(norm(sk.skill_name))
      const expert = ov ? ov.expert : false
      await client.query(
        `INSERT INTO ${TMPSK} (id_master_pokemon, id_skill, pokemon_skill_pref, pokemon_skill_expert)
         VALUES ($1,$2,$3,$4)`,
        [id_mp, sk.skill_id, pref, expert]
      )
    }

    // ── 4. master_pokemon_moves ───────────────────────────────────
    const uniqMoves = [...new Set((move_ids || []).map(Number).filter(Boolean))]
    for (const mid of uniqMoves) {
      await client.query(
        `INSERT INTO ${TMPM} (master_pokemon_moves_move_id, master_pokemon_moves_master_pokemon_id)
         VALUES ($1,$2)`,
        [mid, id_mp]
      )
    }

    // ── 5. Pasiva (habilidad) seleccionada ────────────────────────
    if (id_abilitie) {
      await client.query(
        `INSERT INTO ${TMPP} (id_abilitie, id_master_pokemon) VALUES ($1, $2)`,
        [Number(id_abilitie), id_mp]
      )
    }

    return mp
  })
}

// Edita un Pokémon del master: reemplaza los campos editables (apodo, género, naturaleza,
// tipos, HP, stats base + bono de naturaleza, skills, movimientos y pasiva).
const updatePokemon = async (id_master, id_master_pokemon, data) => {
  const { apodo, genero, id_nature, type_1, type_2, hp, stats, skills, move_ids, id_abilitie } = data
  const id_nat = id_nature != null ? Number(id_nature) : null
  const natureAdj = await computeNatureAdj(id_nat)
  const t1 = type_1 != null ? Number(type_1) : null
  const t2 = type_2 != null ? Number(type_2) : null

  return transaction(async (client) => {
    const { rows } = await client.query(
      `SELECT 1 FROM ${TMP} WHERE id_master_pokemon = $1 AND id_master = $2`,
      [id_master_pokemon, id_master]
    )
    if (!rows.length) return null

    // master_pokemon: campos editables. El HP actual se recorta al nuevo máximo.
    await client.query(
      `UPDATE ${TMP} SET
         pokemon_apodo = $1, personaje_pokemon_genero = $2, personaje_pokemon_nature = $3,
         pokemon_hp = $4, pokemon_current_hp = LEAST(COALESCE(pokemon_current_hp, $4), $4),
         personaje_pokemon_type_1 = $5, personaje_pokemon_type_2 = $6
       WHERE id_master_pokemon = $7 AND id_master = $8`,
      [apodo ?? null, generoTextOf(genero), id_nat, Number(hp) || 0, t1, t2, id_master_pokemon, id_master]
    )

    // stats: base (editable) + bono de naturaleza
    if (stats) {
      const b = k => Number(stats[k]) || 0
      await client.query(
        `UPDATE ${TMPS} SET
           pokemon_dex = $1, pokemon_str = $2, pokemon_con = $3, pokemon_int = $4, pokemon_wis = $5, pokemon_cha = $6,
           pokemon_dex_bonus = $7, pokemon_str_bonus = $8, pokemon_con_bonus = $9,
           pokemon_int_bonus = $10, pokemon_wis_bonus = $11, pokemon_cha_bonus = $12
         WHERE id_master_pokemon = $13`,
        [b('dex'), b('str'), b('con'), b('int'), b('wis'), b('cha'),
         natureAdj.dex, natureAdj.str, natureAdj.con, natureAdj.int, natureAdj.wis, natureAdj.cha,
         id_master_pokemon]
      )
    }

    // skills / movimientos / pasiva: se reemplazan por completo
    if (Array.isArray(skills)) {
      await client.query(`DELETE FROM ${TMPSK} WHERE id_master_pokemon = $1`, [id_master_pokemon])
      for (const s of skills) {
        await client.query(
          `INSERT INTO ${TMPSK} (id_master_pokemon, id_skill, pokemon_skill_pref, pokemon_skill_expert)
           VALUES ($1,$2,$3,$4)`,
          [id_master_pokemon, Number(s.id_skill), !!s.pref, !!s.expert]
        )
      }
    }
    if (Array.isArray(move_ids)) {
      await client.query(`DELETE FROM ${TMPM} WHERE master_pokemon_moves_master_pokemon_id = $1`, [id_master_pokemon])
      for (const mid of [...new Set(move_ids.map(Number).filter(Boolean))]) {
        await client.query(
          `INSERT INTO ${TMPM} (master_pokemon_moves_move_id, master_pokemon_moves_master_pokemon_id)
           VALUES ($1,$2)`,
          [mid, id_master_pokemon]
        )
      }
    }
    await client.query(`DELETE FROM ${TMPP} WHERE id_master_pokemon = $1`, [id_master_pokemon])
    if (id_abilitie) {
      await client.query(`INSERT INTO ${TMPP} (id_abilitie, id_master_pokemon) VALUES ($1,$2)`, [Number(id_abilitie), id_master_pokemon])
    }

    const { rows: out } = await client.query(`SELECT * FROM ${TMP} WHERE id_master_pokemon = $1`, [id_master_pokemon])
    return out[0]
  })
}

// Elimina un Pokémon del master (y sus filas hijas). La pasiva no tiene ON DELETE
// CASCADE, así que se borra manualmente; stats/skills/moves caen por cascada.
const removePokemon = async (id_master, id_master_pokemon) => {
  return transaction(async (client) => {
    const { rows } = await client.query(
      `SELECT 1 FROM ${TMP} WHERE id_master_pokemon = $1 AND id_master = $2`,
      [id_master_pokemon, id_master]
    )
    if (!rows.length) return false
    await client.query(`DELETE FROM ${TMPP} WHERE id_master_pokemon = $1`, [id_master_pokemon])
    await client.query(
      `DELETE FROM ${TMP} WHERE id_master_pokemon = $1 AND id_master = $2`,
      [id_master_pokemon, id_master]
    )
    return true
  })
}

module.exports = {
  findPokemon, findPokemonDetail, updatePokemonCombate,
  setPokemonEnEquipo, setPokemonEnJuego, addPokemon, updatePokemon, removePokemon,
}
