// Reglas de evolución de poke5e que no necesitan la BD: verificar condiciones
// y validar el reparto de puntos de stat. Aparte para poder probarlas.
const { claveMove } = require('./move_name')

const MAX_POR_STAT = 4
const TOPE_STAT = 20
// A nivel 20 el tope sube a 22, igual que en la subida de nivel (confirmAsi)
const topeStat = (nivel) => (Number(nivel) >= 20 ? 22 : TOPE_STAT)
const STAT_KEYS = ['dex', 'str', 'con', 'int', 'wis', 'cha']

const TIEMPOS = { day: 'de día', night: 'de noche', morning: 'por la mañana', afternoon: 'por la tarde', evening: 'al anochecer' }

const textoCondicion = (tipo, valor) => {
  const t = String(tipo || '').toLowerCase()
  const v = String(valor ?? '').trim()
  switch (t) {
    case 'level':     return `Nivel ${v} o más`
    case 'item':      return `Tener ${v}`
    case 'loyalty':   return `Bond nivel ${v} o más`
    case 'gender':    return v.toLowerCase() === 'female' ? 'Ser hembra' : v.toLowerCase() === 'male' ? 'Ser macho' : `Género ${v}`
    case 'move':      return `Conocer ${v.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`
    case 'move-type': return `Conocer un movimiento de tipo ${v.charAt(0).toUpperCase()}${v.slice(1)}`
    case 'time':      return `Evolucionar ${TIEMPOS[v.toLowerCase()] || v}`
    default:          return v.charAt(0).toUpperCase() + v.slice(1)
  }
}

/**
 * Condiciones de una fila de `evolution`, cada una con `cumple`:
 * true / false si la app la puede verificar, null si la confirma el DM (hora
 * del día, condiciones especiales, o un item que no existe en el catálogo).
 * ctx = { nivel, genero, bondLevel, moveClaves:Set, moveTipos:Set,
 *         itemClaves:Set (los que tiene en la mochila),
 *         itemsCatalogoClaves:Set (todos los del catálogo) }
 */
const evaluarCondiciones = (evo, ctx) => {
  const out = []
  for (const n of [1, 2, 3]) {
    const tipo = String(evo?.[`evolution_condition_${n}_type`] || '').trim().toLowerCase()
    const valor = evo?.[`evolution_condition_${n}_value`]
    if (!tipo) continue
    let cumple = null
    if (tipo === 'level') cumple = Number(ctx.nivel) >= Number(valor)
    else if (tipo === 'loyalty') cumple = ctx.bondLevel != null && Number(ctx.bondLevel) >= Number(valor)
    else if (tipo === 'gender') cumple = String(ctx.genero || '').toLowerCase() === String(valor || '').toLowerCase()
    else if (tipo === 'move') cumple = ctx.moveClaves.has(claveMove(valor))
    else if (tipo === 'move-type') cumple = ctx.moveTipos.has(String(valor || '').toLowerCase())
    else if (tipo === 'item') {
      const k = claveMove(valor)
      cumple = ctx.itemsCatalogoClaves.has(k) ? ctx.itemClaves.has(k) : null
    }
    out.push({ tipo, valor, texto: textoCondicion(tipo, valor), cumple })
  }
  return out
}

/** Cuántos puntos se pueden repartir de verdad, dados los topes. */
const capacidad = (statsBase, nivel) =>
  STAT_KEYS.reduce((a, k) => a + Math.max(0, Math.min(MAX_POR_STAT, topeStat(nivel) - (Number(statsBase?.[k]) || 0))), 0)

/**
 * Reparto de los puntos de la evolución: máximo 4 por stat, ningún stat por
 * encima del tope (20, o 22 a nivel 20), y se gastan todos salvo que los topes
 * no lo permitan. Un stat que ya pasaba el tope (por feats, naturaleza...) no
 * bloquea la evolución: solo no puede recibir puntos.
 */
const validarPuntos = (statsBase, adds, puntos, nivel) => {
  const tope = topeStat(nivel)
  let suma = 0
  for (const k of STAT_KEYS) {
    const raw = adds?.[k] ?? 0
    const a = Number(raw)
    if (!Number.isInteger(a) || a < 0) return { error: 'entero' }
    if (a > MAX_POR_STAT) return { error: 'por_stat' }
    if (a > 0 && (Number(statsBase?.[k]) || 0) + a > tope) return { error: 'tope', tope }
    suma += a
  }
  const debe = Math.min(Number(puntos) || 0, capacidad(statsBase, nivel))
  if (suma !== debe) return { error: 'suma', debe }
  return { ok: true }
}

module.exports = { evaluarCondiciones, validarPuntos, capacidad, topeStat, textoCondicion, STAT_KEYS, MAX_POR_STAT, TOPE_STAT }
