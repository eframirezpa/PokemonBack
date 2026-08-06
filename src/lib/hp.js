// HP efectivo del personaje (puerto del front `front/src/lib/hp.js`).
// La vida guardada (personaje_hp) es solo la base (6 + healing de origen/background).
// El máximo mostrado le suma el modificador de CON y los bonos de healing de feats
// y especialidades. Los feats que no cumplen prerequisitos no aportan nada.

const norm = s => (s ?? '').toLowerCase()
const STAT_KEYS = ['dex', 'str', 'con', 'int', 'wis', 'cha']

// Un bono de healing se escribe "2 per lvl" si escala con el nivel, o como un
// número suelto si es plano. Es la misma convención que usan los feats de
// Pokémon, y evita reconocer los feats por id.
const PER_LVL = /(\d+)\s*per\s*l/i

// Lo que aporta UNA instancia del bono, o sea su valor a nivel 1. Es lo que la
// creación del personaje hornea en personaje_hp.
function healingBase(value) {
  const m = PER_LVL.exec(String(value ?? ''))
  return m ? Number(m[1]) : (Number(value) || 0)
}

// Lo que aporta el bono completo a un nivel dado.
function healingAtLevel(value, level) {
  const m = PER_LVL.exec(String(value ?? ''))
  return m ? Number(m[1]) * Math.max(1, Number(level) || 1) : (Number(value) || 0)
}

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
    for (const b of (ef.bonos || [])) {
      const type = norm(b.type)
      if (type === 'stat' && norm(b.llave) === 'con') statAdd += Number(b.value) || 0
      else if (type === 'healing') healing += healingAtLevel(b.value, level)
    }
  }

  // Feats de origen/background: son los únicos que la creación ya aplicó, y lo
  // hizo horneando UNA instancia del bono (la de nivel 1) dentro de personaje_hp.
  // Aquí solo se repone lo que falta por los niveles restantes: un bono plano no
  // aporta nada extra, uno "N per lvl" aporta N × (nivel − 1).
  // Se filtra por llave 'hp' para calcar exactamente lo que hornea el wizard.
  for (const f of [full.origin_feat, full.background_feat]) {
    for (const b of (f?.bonos || [])) {
      if (norm(b.type) !== 'healing' || norm(b.llave) !== 'hp') continue
      healing += healingAtLevel(b.value, level) - healingBase(b.value)
    }
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

// Healing que aportan los feats del Pokémon. Los feats de Pokémon no se hornean
// en ningún lado, así que van completos.
function pokemonHealing(feats, level) {
  let total = 0
  for (const f of (feats || [])) {
    for (const b of (f.bonos || [])) {
      if (norm(b.type) !== 'healing') continue
      total += healingAtLevel(b.value, level)
    }
  }
  return total
}

// Suma en vivo al HP máximo: modificador de CON por nivel más el healing de feats.
// Un CON bajo (modificador negativo) no resta vida: el piso es 0, así que el
// máximo nunca queda por debajo del pokemon_hp guardado.
function pokemonHpExtra({ stats, feats, level }) {
  const lvl = Math.max(1, Number(level) || 1)
  const mod = Math.max(0, Math.floor((pokemonCon(stats, feats) - 10) / 2))
  return mod * lvl + pokemonHealing(feats, lvl)
}

// Máximo efectivo de un Pokémon = pokemon_hp guardado + modCON × nivel
function effectivePokemonMaxHp(pp, stats, feats) {
  return (Number(pp?.pokemon_hp) || 0) + pokemonHpExtra({ stats, feats, level: pp?.pokemon_level })
}

module.exports = {
  hpExtra, effectiveMaxHp, pokemonCon, pokemonHpExtra, effectivePokemonMaxHp,
  healingBase, healingAtLevel,
}
