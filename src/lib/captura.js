// Captura automática de Pokémon (poke5e, rules/catching-pokemon).
//
// DC = 10 + SR + nivel del Pokémon, menos 5 si está bajo media vida, otros 5
// si está bajo el 10 %, y menos lo que descuente la pokébola. El entrenador
// tira d20 + Animal Handling y lo atrapa si iguala o supera la DC.
//
// Acuerdos con el DM (2026-10-14):
// - No hay tope por nivel: se puede atrapar un Pokémon de más nivel que el
//   entrenador (la regla oficial lo prohíbe; en esta mesa no).
// - Un SR fraccionario ("1/2", "1/4"...) cuenta como 1.
// - La experiencia por atraparlo la reparte el DM a mano: aquí no se toca.
//
// Funciones puras: las usa captura.service.js y las prueba test/captura.test.js.
// La lista de pokébolas con condición vive también en front/src/lib/captura.js
// (lo que el jugador marca en la ventana); si se agrega una, tocar los dos.

/** SR para la DC: entero tal cual; fracción o texto raro ("Varies") cuenta 1. */
const srCaptura = (sr) => {
  const txt = String(sr ?? '').trim()
  if (/^\d+$/.test(txt)) return Math.max(1, Number(txt))
  return 1
}

/** 'Poké Ball' → 'poke', 'Great Ball' → 'great'. La clave de cada pokébola. */
const claveBola = (nombre) => String(nombre ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .trim().toLowerCase().split(/\s+/)[0] || ''

const TAMANIOS_GRANDES = new Set(['medium', 'large', 'huge', 'gargantuan'])

const entero = (v, min, max, def = 0) => {
  const n = Math.trunc(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def
}

/**
 * Lo que descuenta la pokébola, con el motivo. Las que dependen de algo que
 * la app no sabe (pescando, bajo el agua, de noche...) llegan como
 * `condicion` marcada por el jugador; las que sí puede saber se calculan.
 */
const descuentoBola = (clave, ctx) => {
  const t = (ctx.tipos || []).map(x => String(x || '').toLowerCase())
  switch (clave) {
    case 'great':  return { valor: 5,  motivo: 'Great Ball' }
    case 'ultra':  return { valor: 10, motivo: 'Ultra Ball' }
    case 'level':  return ctx.nivelEntrenador > ctx.nivel ? { valor: 5, motivo: 'Level Ball: el entrenador tiene más nivel' } : null
    case 'heavy':  return TAMANIOS_GRANDES.has(String(ctx.tamanio || '').toLowerCase()) ? { valor: 10, motivo: 'Heavy Ball: tamaño Medium o mayor' } : null
    case 'net':    return (t.includes('water') || t.includes('bug')) ? { valor: 10, motivo: 'Net Ball: tipo Agua o Bicho' } : null
    case 'nest':   return ctx.nivel <= 5 ? { valor: 5, motivo: 'Nest Ball: nivel 5 o menos' } : null
    case 'quick':  return ctx.primeraRonda ? { valor: 15, motivo: 'Quick Ball: primera ronda de combate' } : null
    case 'repeat': return ctx.yaAtrapada ? { valor: 10, motivo: 'Repeat Ball: especie ya atrapada' } : null
    case 'timer': {
      const turnos = entero(ctx.turnos, 0, 10)
      return turnos > 0 ? { valor: turnos, motivo: `Timer Ball: ${turnos} turno${turnos === 1 ? '' : 's'} concentrado` } : null
    }
    // Las que dependen de algo que solo sabe la mesa: las marca el jugador
    case 'lure':   return ctx.condicion ? { valor: 10, motivo: 'Lure Ball: pescando' } : null
    case 'dive':   return ctx.condicion ? { valor: 10, motivo: 'Dive Ball: bajo el agua' } : null
    case 'dusk':   return ctx.condicion ? { valor: 10, motivo: 'Dusk Ball: de noche o a oscuras' } : null
    case 'moon':   return ctx.condicion ? { valor: 10, motivo: 'Moon Ball: evoluciona con Moon Stone' } : null
    case 'dream':  return ctx.condicion ? { valor: 5,  motivo: 'Dream Ball: está dormido' } : null
    // Las que descuentan un modificador del entrenador o de su Pokémon: lo
    // calcula su ficha en el cliente, igual que el Animal Handling
    case 'safari': return { valor: entero(ctx.bonoBola, -10, 30), motivo: 'Safari Ball: modificador de Nature' }
    case 'friend': return { valor: entero(ctx.bonoBola, -10, 30), motivo: 'Friend Ball: modificador de Persuasion' }
    case 'sport':  return { valor: entero(ctx.bonoBola, -10, 30), motivo: 'Sport Ball: modificador de Athletics' }
    case 'love':   return { valor: entero(ctx.bonoBola, -10, 30), motivo: 'Love Ball: el doble del CHA de tu Pokémon' }
    default:       return null
  }
}

/**
 * La DC de la captura y de dónde sale cada número.
 * ctx: { nivel, sr, hpActual, hpMax, bola (nombre), tipos, tamanio,
 *        nivelEntrenador, primeraRonda, yaAtrapada, condicion, turnos, bonoBola }
 * → { automatica, dc, desglose: [{ motivo, valor }] }
 */
const calcularDC = (ctx) => {
  const clave = claveBola(ctx.bola)
  if (clave === 'master') return { automatica: true, dc: null, desglose: [{ motivo: 'Master Ball: éxito automático', valor: 0 }] }

  const nivel = Math.max(1, Number(ctx.nivel) || 1)
  const sr = srCaptura(ctx.sr)
  const desglose = [{ motivo: 'Base', valor: 10 }, { motivo: 'SR', valor: sr }, { motivo: 'Nivel', valor: nivel }]

  const hpMax = Number(ctx.hpMax) || 0
  const hp = Number(ctx.hpActual) || 0
  if (hpMax > 0 && hp < hpMax / 2) desglose.push({ motivo: 'Bajo media vida', valor: -5 })
  if (hpMax > 0 && hp < hpMax * 0.1) desglose.push({ motivo: 'Bajo el 10 % de vida', valor: -5 })

  const bola = descuentoBola(clave, { ...ctx, nivel })
  if (bola && bola.valor !== 0) desglose.push({ motivo: bola.motivo, valor: -bola.valor })

  return { automatica: false, dc: desglose.reduce((a, d) => a + d.valor, 0), desglose }
}

/**
 * Cuántas veces se balancea la pokébola antes del desenlace: tres si lo
 * atrapó; si escapó, más cuanto más cerca estuvo la tirada. Es solo para la
 * animación, pero se decide aquí para que toda la mesa vea lo mismo.
 */
const sacudidas = (exito, total, dc) => {
  if (exito) return 3
  const falta = (Number(dc) || 0) - (Number(total) || 0)
  if (falta <= 2) return 2
  if (falta <= 5) return 1
  return 0
}

module.exports = { srCaptura, claveBola, calcularDC, sacudidas, entero }
