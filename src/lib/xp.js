// Cálculos de la experiencia en mesa, sin base de datos (se prueban solos).
//
// Reglas de Pokémon 5e (poke5e.app/reference/pokemon-leveling):
//   - derrotar → 200 x nivel x SR
//   - atrapar  → 1/5 de eso
//   - si varios entrenadores intervienen, el DM decide cuánto le toca a cada uno;
//     cada entrenador reparte su parte entre sus Pokémon como quiera.
// Es la misma fórmula que front/src/lib/xpAtrapar.js.

const parseSR = (sr) => {
  const s = String(sr ?? '').trim()
  if (!s) return null
  if (s.includes('/')) {
    const [a, b] = s.split('/').map(Number)
    return (a && b) ? a / b : null
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

const xpAlDerrotar = (nivel, sr) => {
  const lvl = Number(nivel)
  const srNum = parseSR(sr)
  if (!Number.isFinite(lvl) || lvl <= 0 || srNum == null || srNum <= 0) return null
  return Math.round(200 * lvl * srNum)
}

const xpAlAtrapar = (nivel, sr) => {
  const xp = xpAlDerrotar(nivel, sr)
  return xp == null ? null : Math.round(xp / 5)
}

const xpPorMotivo = (motivo, nivel, sr) =>
  motivo === 'captura' ? xpAlAtrapar(nivel, sr) : xpAlDerrotar(nivel, sr)

/**
 * Intervenciones agrupadas por entrenador, para el pop-up del DM:
 * [{ id_personaje, ataques, pokebolas, pokemones: [id_personaje_pokemon...] }]
 * en el orden en que intervino cada uno por primera vez.
 */
const agruparIntervenciones = (filas) => {
  const porPj = new Map()
  for (const f of filas || []) {
    const id = Number(f.id_personaje)
    if (!porPj.has(id)) porPj.set(id, { id_personaje: id, ataques: 0, pokebolas: 0, pokemones: [] })
    const g = porPj.get(id)
    if (f.intervencion_tipo === 'pokebola') g.pokebolas++
    else g.ataques++
    const pp = f.id_personaje_pokemon == null ? null : Number(f.id_personaje_pokemon)
    if (pp != null && !g.pokemones.includes(pp)) g.pokemones.push(pp)
  }
  return [...porPj.values()]
}

/** Partes iguales que suman exacto el total; el resto va a los primeros. */
const repartoIgual = (total, n) => {
  const t = Math.max(0, Math.floor(Number(total) || 0))
  if (!n || n < 1) return []
  const base = Math.floor(t / n)
  const resto = t - base * n
  return Array.from({ length: n }, (_, i) => base + (i < resto ? 1 : 0))
}

/**
 * Reparto del DM entre entrenadores: [{ id_personaje, xp }], sin repetidos,
 * cantidades enteras >= 0 y que no pasen del total de ese Pokémon.
 * Devuelve { ok: true, reparto } o { error }.
 */
const validarRepartoDm = (reparto, total) => {
  if (!Array.isArray(reparto) || reparto.length === 0) return { error: 'vacio' }
  const vistos = new Set()
  const limpio = []
  for (const r of reparto) {
    const id = Number(r?.id_personaje)
    const xp = Number(r?.xp)
    if (!Number.isInteger(id) || id <= 0) return { error: 'personaje' }
    if (!Number.isInteger(xp) || xp < 0) return { error: 'cantidad' }
    if (vistos.has(id)) return { error: 'repetido' }
    vistos.add(id)
    limpio.push({ id_personaje: id, xp })
  }
  const suma = limpio.reduce((s, r) => s + r.xp, 0)
  if (suma > total) return { error: 'excede' }
  return { ok: true, reparto: limpio }
}

/**
 * Lo que el entrenador reparte entre sus Pokémon: [{ id_personaje_pokemon, xp }].
 * Debe sumar exactamente su parte, sin repetidos y solo con Pokémon suyos.
 */
const validarAsignacion = (asignacion, parte, idsPropios) => {
  if (!Array.isArray(asignacion) || asignacion.length === 0) return { error: 'vacio' }
  const propios = new Set((idsPropios || []).map(Number))
  const vistos = new Set()
  const limpio = []
  for (const a of asignacion) {
    const id = Number(a?.id_personaje_pokemon)
    const xp = Number(a?.xp)
    if (!propios.has(id)) return { error: 'ajeno' }
    if (!Number.isInteger(xp) || xp < 0) return { error: 'cantidad' }
    if (vistos.has(id)) return { error: 'repetido' }
    vistos.add(id)
    if (xp > 0) limpio.push({ id_personaje_pokemon: id, xp })
  }
  const suma = limpio.reduce((s, a) => s + a.xp, 0)
  if (suma !== Number(parte)) return { error: 'suma', esperado: Number(parte), suma }
  return { ok: true, asignacion: limpio }
}

module.exports = {
  parseSR, xpAlDerrotar, xpAlAtrapar, xpPorMotivo,
  agruparIntervenciones, repartoIgual, validarRepartoDm, validarAsignacion,
}
