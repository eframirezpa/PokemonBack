// HP efectivo del personaje (puerto del front `front/src/lib/hp.js`).
// La vida guardada (personaje_hp) es solo la base (6 + healing de origen/background).
// El máximo mostrado le suma el modificador de CON y los bonos de healing de feats
// y especialidades. Los feats que no cumplen prerequisitos no aportan nada.

const norm = s => (s ?? '').toLowerCase()
const STAT_KEYS = ['dex', 'str', 'con', 'int', 'wis', 'cha']

const FEAT_TOUGH = 12         // Tough: su bono de HP aplica por cada nivel del personaje
const TOUGH_HP_PER_LEVEL = 2  // valor del bono (el feat de origen/background no trae sus bonos)

// ── Prerequisitos de feats (nivel / stat / armor prof) ──
function prereqMet(prereq, valor, ctx) {
  const p = norm(prereq).trim()
  if (!p) return true
  if (p === 'lvl') return (ctx.level || 0) >= (Number(valor) || 0)
  if (STAT_KEYS.includes(p)) return (ctx.statTotal(p) || 0) >= (Number(valor) || 0)
  if (p === 'armor prof') return ctx.armorProfs.has(norm(valor).trim())
  return true // prereq desconocido → no bloquea
}
function featPrereqMet(prereqs, ctx) {
  for (const pr of (prereqs || [])) if (!prereqMet(pr.prereq, pr.valor, ctx)) return false
  return true
}
function buildPrereqContext(full) {
  const level = full?.personaje_level || 0
  const stats = full?.stats || {}
  const featStatAdd = {}
  for (const ef of (full?.extra_feats || [])) {
    for (const b of (ef.bonos || [])) {
      if (norm(b.type) === 'stat') {
        const k = norm(b.llave)
        featStatAdd[k] = (featStatAdd[k] || 0) + (Number(b.value) || 0)
      }
    }
  }
  const statTotal = k => (Number(stats[`personaje_${k}`]) || 0) + (Number(stats[`personaje_${k}_bonus`]) || 0) + (featStatAdd[k] || 0)
  const armorProfs = new Set((full?.armor_profs || []).map(a => norm(a).trim()))
  for (const v of [
    full?.background_armor_proficiencies_value_1, full?.background_armor_proficiencies_value_2,
    full?.background_armor_proficiencies_value_3, full?.background_armor_proficiencies_value_4,
  ]) if (v) armorProfs.add(norm(v).trim())
  return { level, statTotal, armorProfs }
}

// Suma que hay que aplicar al HP guardado (máximo y actual)
function hpExtra(full) {
  if (!full) return 0
  const ctx   = buildPrereqContext(full)
  const stats = full.stats || {}
  const level = Math.max(1, Number(full.personaje_level) || 1)
  let statAdd = 0, healing = 0

  for (const ef of (full.extra_feats || [])) {
    if (ctx && !featPrereqMet(ef.prereqs, ctx)) continue
    const perLevel = Number(ef.feat_id) === FEAT_TOUGH ? level : 1
    for (const b of (ef.bonos || [])) {
      const type = norm(b.type)
      if (type === 'stat' && norm(b.llave) === 'con') statAdd += Number(b.value) || 0
      else if (type === 'healing') healing += (Number(b.value) || 0) * perLevel
    }
  }

  // Tough de origen/background: el HP guardado ya trae el bono una vez (nivel 1),
  // faltan los niveles restantes.
  for (const f of [full.origin_feat, full.background_feat]) {
    if (Number(f?.feat_id) === FEAT_TOUGH) healing += TOUGH_HP_PER_LEVEL * (level - 1)
  }
  for (const sp of (full.specializations || [])) {
    for (const b of (sp.bonos || [])) {
      const type = norm(b.type)
      if (type === 'stat' && norm(b.llave) === 'con') statAdd += Number(b.value) || 0
      else if (type === 'healing') healing += Number(b.value) || 0
    }
  }

  const con = (Number(stats.personaje_con) || 0) + (Number(stats.personaje_con_bonus) || 0) + statAdd
  return Math.floor((con - 10) / 2) + healing
}

// Máximo efectivo = base guardada + hpExtra
function effectiveMaxHp(full) {
  return (Number(full?.personaje_hp) || 0) + hpExtra(full)
}

// ── HP de los Pokémon del entrenador ─────────────────────────────────────────
// pokemon_hp guarda la base del pokédex más las tiradas de dado acumuladas al
// subir de nivel. El máximo mostrado le suma el modificador de CON por cada
// nivel; es un cálculo en vivo, nunca se persiste.
// pokemon_current_hp es un valor absoluto de combate, igual que en el personaje.

// CON total del Pokémon: base + bonus de la tabla + bonos de stat de sus feats
function pokemonCon(stats, feats) {
  let featAdd = 0
  for (const f of (feats || [])) {
    for (const b of (f.bonos || [])) {
      if (norm(b.type) === 'stat' && norm(b.llave) === 'con') featAdd += Number(b.value) || 0
    }
  }
  return (Number(stats?.pokemon_con) || 0) + (Number(stats?.pokemon_con_bonus) || 0) + featAdd
}

// Suma en vivo al HP máximo: modificador de CON por cada nivel.
// Un CON bajo (modificador negativo) no resta vida: el piso es 0, así que el
// máximo nunca queda por debajo del pokemon_hp guardado.
function pokemonHpExtra({ stats, feats, level }) {
  const lvl = Math.max(1, Number(level) || 1)
  const mod = Math.max(0, Math.floor((pokemonCon(stats, feats) - 10) / 2))
  return mod * lvl
}

// Máximo efectivo de un Pokémon = pokemon_hp guardado + modCON × nivel
function effectivePokemonMaxHp(pp, stats, feats) {
  return (Number(pp?.pokemon_hp) || 0) + pokemonHpExtra({ stats, feats, level: pp?.pokemon_level })
}

module.exports = { hpExtra, effectiveMaxHp, pokemonCon, pokemonHpExtra, effectivePokemonMaxHp }
