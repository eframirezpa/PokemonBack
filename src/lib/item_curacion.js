// Interpreta la descripción de un item de medicina o baya para saber si cura
// HP y cómo. Se lee del texto del catálogo a propósito: si mañana se cambia un
// valor allí, la automatización lo sigue sin tocar código.
//
// Solo cuenta lo inmediato ("restores 2d4 + 2 HP", "restores 30 HP"). Los
// efectos con espera ("10 minutes after consumption... regains 70 HP"), HP
// temporal, vitaminas y PP no coinciden y quedan como el flujo manual de
// siempre.
const CON_DADOS = /restores?\s+(\d+)\s*d\s*(\d+)(?:\s*\+\s*(\d+))?\s*HP/i
const FIJO      = /restores?\s+(\d+)\s*HP/i

/**
 * @returns null si el item no cura HP de forma automática, o
 *   { dados: { n, caras, mod } | null, fijo: number | null, revive: boolean,
 *     min, max }   min/max = curación posible (para validar la tirada)
 */
const parseCuracion = (item) => {
  const tipo = String(item?.item_type || '').toLowerCase()
  if (tipo !== 'medicine' && tipo !== 'berry') return null
  const desc = String(item?.item_description || '')
  const revive = /fainted\s+Pok[eé]mon/i.test(desc) && !/revive up to/i.test(desc)

  const d = desc.match(CON_DADOS)
  if (d) {
    const n = Number(d[1]), caras = Number(d[2]), mod = Number(d[3] || 0)
    return { dados: { n, caras, mod }, fijo: null, revive, min: n + mod, max: n * caras + mod }
  }
  const f = desc.match(FIJO)
  if (f) {
    const fijo = Number(f[1])
    return { dados: null, fijo, revive, min: fijo, max: fijo }
  }
  return null
}

const PP = /restores?\s+(\d+)\s*PP\s+to\s+(all moves|a single moves?|a move)/i

/**
 * Items que devuelven PP (Ether, Max Ether, Elixir, Max Elixir, Leppa Berry).
 * @returns null o { cantidad, todos }  todos = a todos los movimientos, si no, a uno
 */
const parsePP = (item) => {
  const tipo = String(item?.item_type || '').toLowerCase()
  if (tipo !== 'medicine' && tipo !== 'berry') return null
  const m = String(item?.item_description || '').match(PP)
  return m ? { cantidad: Number(m[1]), todos: /all moves/i.test(m[2]) } : null
}

const ESTADO_POR_PALABRA = [
  [/paraly/i, 'paralizado'], [/\basleep\b|\bsleep\b/i, 'dormido'], [/poison/i, 'envenenado'],
  [/burn/i, 'quemado'], [/freez|frozen/i, 'congelado'], [/confus/i, 'confuso'],
]

/**
 * Items que curan estados alterados (Antidote, Full Heal, bayas Cheri/Lum...).
 * @returns null o { estados: [claves] | null, modo: 'lista'|'todos'|'uno' }
 *   'lista' cura los estados de `estados`; 'todos' cura cualquiera y todos;
 *   'uno' (Lum) cura el que el jugador elija.
 */
const parseEstado = (item) => {
  const tipo = String(item?.item_type || '').toLowerCase()
  if (tipo !== 'medicine' && tipo !== 'berry') return null
  const desc = String(item?.item_description || '')
  if (/minutes? after/i.test(desc)) return null              // Full Restore: efecto con espera
  const clausula = desc.match(/\bcures?\b[^.]*/i)?.[0]
  if (!clausula) return null
  if (/all status conditions/i.test(clausula)) return { estados: null, modo: 'todos' }
  if (/any single status condition/i.test(clausula)) return { estados: null, modo: 'uno' }
  const estados = ESTADO_POR_PALABRA.filter(([re]) => re.test(clausula)).map(([, e]) => e)
  return estados.length ? { estados, modo: 'lista' } : null
}

module.exports = { parseCuracion, parsePP, parseEstado }
