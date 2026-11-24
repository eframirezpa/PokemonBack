// Estados alterados (poke5e, Status Conditions). Misma lista que
// front/src/lib/estados.js: si se agrega uno, tocar los dos sitios.
//
// - No volátiles: uno a la vez (paralizado, dormido, envenenado,
//   envenenado_grave, quemado, congelado).
// - Volátiles: además de uno no volátil (confuso, retroceso). Terminan fuera
//   de combate o al cambiar de Pokémon.
// Se guardan como texto "quemado,confuso" (como siempre) y aparte sus datos
// en *_estados_meta (jsonb):
//   { dormido: { restantes: 3 }, congelado: { dc: 13 }, gracia: { quemado: 1 } }
//   restantes: finales de turno que le quedan · dc: para liberarse de Congelado
//   gracia: tras curarse, no puede volver a sufrirlo hasta el final de su siguiente turno

const NO_VOLATILES = ['paralizado', 'dormido', 'envenenado', 'envenenado_grave', 'quemado', 'congelado']
const VOLATILES = ['confuso', 'retroceso']
const ESTADOS = [...NO_VOLATILES, ...VOLATILES]

const lista = (x) => (Array.isArray(x) ? x : String(x ?? '').split(','))
  .map(e => String(e).trim().toLowerCase()).filter(Boolean)

/** Uno no volátil y uno volátil como mucho (el primero de cada clase). Texto o null. */
const sanearEstados = (estados) => {
  const l = lista(estados)
  const nv = l.find(e => NO_VOLATILES.includes(e))
  const v = l.find(e => VOLATILES.includes(e))
  const out = [nv, v].filter(Boolean)
  return out.length ? out.join(',') : null
}

const entero = (n, min, max) => {
  const v = Math.trunc(Number(n))
  return Number.isFinite(v) && v >= min && v <= max ? v : null
}

/** Solo datos conocidos de los estados que tiene, y la gracia de los conocidos. */
const sanearMeta = (meta, estadosTexto) => {
  const tiene = lista(estadosTexto)
  const m = meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {}
  const out = {}
  for (const e of tiene) {
    const d = m[e]
    if (!d || typeof d !== 'object') continue
    const o = {}
    const r = entero(d.restantes, 0, 99); if (r != null) o.restantes = r
    const dc = entero(d.dc, 1, 40); if (dc != null) o.dc = dc
    if (Object.keys(o).length) out[e] = o
  }
  if (m.gracia && typeof m.gracia === 'object') {
    const g = {}
    for (const [k, v] of Object.entries(m.gracia)) {
      const n = entero(v, 1, 9)
      if (ESTADOS.includes(k) && n != null && !tiene.includes(k)) g[k] = n
    }
    if (Object.keys(g).length) out.gracia = g
  }
  return Object.keys(out).length ? out : null
}

/** Meta tras quitarle estados (cura): pierden sus datos y entran en gracia. */
const metaTrasQuitar = (meta, quitados, quedan) => {
  const m = meta && typeof meta === 'object' ? { ...meta } : {}
  const gracia = { ...(m.gracia || {}) }
  for (const e of quitados) { delete m[e]; gracia[e] = 1 }
  m.gracia = gracia
  return sanearMeta(m, quedan)
}

module.exports = { ESTADOS, NO_VOLATILES, VOLATILES, sanearEstados, sanearMeta, metaTrasQuitar }
