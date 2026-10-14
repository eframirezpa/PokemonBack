// Sesiones de juego a partir del registro de la partida. No hay un "iniciar
// sesión": se juega una vez al mes, así que dos líneas del log separadas por
// más de 6 horas pertenecen a sesiones distintas.
const PAUSA_MS = 6 * 60 * 60 * 1000

// Lo que se lista una por una en el resumen; el resto solo se cuenta.
const TIPOS_DESTACADOS = ['captura', 'evolucion', 'nivel', 'pokemon']

/** filas ordenadas por fecha ascendente: [{ id, time, ... }] → [[...], [...]] */
const agruparSesiones = (filas) => {
  const out = []
  let actual = null, previo = null
  for (const f of filas) {
    const t = new Date(f.time).getTime()
    if (!actual || t - previo > PAUSA_MS) { actual = []; out.push(actual) }
    actual.push(f)
    previo = t
  }
  return out
}

/**
 * La sesión anterior a la de ahora. Si la última tuvo actividad hace menos de
 * 6 horas, se está jugando todavía: la anterior es la penúltima.
 */
const sesionAnterior = (filas, ahora = Date.now()) => {
  const ses = agruparSesiones(filas)
  if (!ses.length) return null
  const ultima = ses[ses.length - 1]
  const finUltima = new Date(ultima[ultima.length - 1].time).getTime()
  if (ahora - finUltima <= PAUSA_MS) return ses.length > 1 ? ses[ses.length - 2] : null
  return ultima
}

/** Conteos por tipo y las líneas destacadas de una sesión. */
const resumir = (sesion) => {
  if (!sesion?.length) return null
  const conteos = {}
  for (const f of sesion) {
    const t = f.tipo || 'otro'
    conteos[t] = (conteos[t] || 0) + 1
  }
  return {
    id_inicio: sesion[0].id,
    desde: sesion[0].time,
    hasta: sesion[sesion.length - 1].time,
    total: sesion.length,
    conteos,
    destacados: sesion.filter(f => TIPOS_DESTACADOS.includes(f.tipo)).map(f => ({ tipo: f.tipo, texto: f.texto, time: f.time })),
  }
}

module.exports = { agruparSesiones, sesionAnterior, resumir, PAUSA_MS, TIPOS_DESTACADOS }
