// Resuelve el MÁXIMO de un recurso de ruta a partir de path_bonus_uses_formula.
//
// La fórmula nombra de dónde sale el tope:
//
//     "personaje.personaje_level"   → tabla y campo
//     "pokemon_stats.pokemon_con"   → idem, sobre el Pokémon
//     "personaje_level"             → forma antigua: campo suelto de personaje
//
// La forma antigua se sigue aceptando porque hay filas ya guardadas con ella en
// personaje_path_bonus; migrarlas no aporta nada y romperlas sí.
//
// De quién es la fila lo decide el TARGET del bono: 'trainer' apunta al
// personaje y 'pokemon' a un Pokémon suyo. Solo se admiten tablas con UNA fila
// por entidad; una tabla de varias filas no tiene un valor único y se descarta.
//
// Vive aparte porque el mismo número hace falta en cinco sitios —confirmar el
// nivel, listar los recursos, gastar, ajustar con el lápiz y descansar— y si
// cada uno lo resolviera a su manera acabarían dando topes distintos.
const { query, SCHEMA } = require('../config/db')

// Columna por la que se localiza la fila, según a quién pertenezca la tabla
const CLAVE_TRAINER = 'id_personaje'
const CLAVE_POKEMON = 'id_personaje_pokemon'

// information_schema es caro de consultar por llamada: se recuerda por tabla.
const _columnas = new Map()   // tabla → Set(columnas)

const columnasDe = async (tabla, run = query) => {
  if (_columnas.has(tabla)) return _columnas.get(tabla)
  const { rows } = await run(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2`, [SCHEMA, tabla])
  const set = new Set(rows.map(r => r.column_name))
  _columnas.set(tabla, set)
  return set
}

/**
 * Parte la fórmula en tabla y campo. Devuelve null si viene vacía o con prosa
 * (el catálogo trae descripciones en algunas filas, y esas no son fórmulas).
 */
const partir = (formula) => {
  const txt = String(formula || '').trim()
  if (!txt || /\s/.test(txt)) return null   // con espacios es prosa, no un campo
  // Se descartan los trozos vacíos: en el catálogo hay fórmulas con un punto de
  // más (".personaje.personaje_level") y un dedazo así no debe desactivar un
  // bono en silencio.
  const partes = txt.split('.').filter(Boolean)
  if (partes.length === 1) return { tabla: 'personaje', campo: partes[0] }
  if (partes.length === 2) return { tabla: partes[0], campo: partes[1] }
  return null
}

/**
 * Máximo del recurso.
 *
 * @param formula  contenido de uses_formula / personaje_path_bonus_value
 * @param ids      { id_personaje, id_personaje_pokemon }
 * @returns número >= 0, o null si la fórmula no se puede resolver
 */
const maximoDeFormula = async (formula, ids = {}, run = query) => {
  const ref = partir(formula)
  if (!ref) return null

  const cols = await columnasDe(ref.tabla, run)
  if (!cols.size) return null                  // la tabla no existe
  if (!cols.has(ref.campo)) return null        // el campo no existe

  // A quién pertenece la fila lo dice la clave que tenga la tabla
  const porPokemon = cols.has(CLAVE_POKEMON)
  const clave = porPokemon ? CLAVE_POKEMON : (cols.has(CLAVE_TRAINER) ? CLAVE_TRAINER : null)
  if (!clave) return null                      // sin forma de localizar la fila

  const id = porPokemon ? ids.id_personaje_pokemon : ids.id_personaje
  if (id == null) return null                  // falta el id del dueño

  // tabla y campo ya se validaron contra el esquema; el id va parametrizado
  const { rows } = await run(
    `SELECT "${ref.campo}" AS v FROM "${SCHEMA}"."${ref.tabla}" WHERE "${clave}" = $1 LIMIT 1`,
    [id])
  if (!rows.length) return null
  return Math.max(0, Number(rows[0].v) || 0)
}

/** Igual que la anterior pero devuelve 0 en vez de null, para pintar la ficha */
const maximoOCero = async (formula, ids, run = query) =>
  (await maximoDeFormula(formula, ids, run)) ?? 0

/**
 * Recursos que viven en la fila del propio dueño, no en personaje_path_bonus.
 *
 * La fórmula trae los dos campos separados por "/": primero el actual y después
 * el máximo.
 *
 *   "personaje_pokemon.<current>/personaje_pokemon.<points>"
 *
 * Es el caso de los bond points: cada Pokémon lleva los suyos en su fila, así
 * que un mismo bono de ruta se traduce en tantos contadores como Pokémon tenga
 * el entrenador. Por eso no se guardan en personaje_path_bonus, que solo admite
 * un valor por bono.
 *
 * @returns { actual, maximo, campoActual, campoMaximo, tabla } o null
 */
const parExplicito = (formula) => {
  const txt = String(formula || '').trim()
  if (!txt.includes('/')) return null
  const [a, b] = txt.split('/')
  const ref1 = partir(a), ref2 = partir(b)
  if (!ref1 || !ref2) return null
  // Los dos campos tienen que vivir en la misma fila para leerse de una vez
  if (ref1.tabla !== ref2.tabla) return null
  return { tabla: ref1.tabla, campoActual: ref1.campo, campoMaximo: ref2.campo }
}

const parDeFormula = async (formula, ids = {}, run = query) => {
  const ref = parExplicito(formula)
  if (!ref) return null

  const cols = await columnasDe(ref.tabla, run)
  if (!cols.has(ref.campoActual) || !cols.has(ref.campoMaximo)) return null

  const porPokemon = cols.has(CLAVE_POKEMON)
  const clave = porPokemon ? CLAVE_POKEMON : (cols.has(CLAVE_TRAINER) ? CLAVE_TRAINER : null)
  if (!clave) return null
  const id = porPokemon ? ids.id_personaje_pokemon : ids.id_personaje
  if (id == null) return null

  const { rows } = await run(
    `SELECT "${ref.campoActual}" AS actual, "${ref.campoMaximo}" AS maximo
       FROM "${SCHEMA}"."${ref.tabla}" WHERE "${clave}" = $1 LIMIT 1`, [id])
  if (!rows.length) return null
  return {
    ...ref,
    actual: Number(rows[0].actual) || 0,
    maximo: Number(rows[0].maximo) || 0,
  }
}

// ── Fórmulas en prosa ────────────────────────────────────────────────────────
//
// Algunas fórmulas del catálogo no nombran una columna sino que están escritas
// para leerse: "1 + Dex modifier". Se interpretan aquí porque el número tiene
// que salir igual al alcanzar el nivel, al pintar la ficha y al descansar.
//
// Se admite una constante, un modificador de característica, o los dos sumados
// o restados. Cualquier otra cosa devuelve null, y quien llama decide: es
// preferible no dar un número a dar uno inventado.
const STATS_PROSA = {
  dex: 'personaje_dex', str: 'personaje_str', con: 'personaje_con',
  int: 'personaje_int', wis: 'personaje_wis', cha: 'personaje_cha',
}

// "minimum 1" en uses_limit: el piso del resultado. Sin él, un modificador
// negativo dejaría el recurso en cero y el rasgo sin efecto.
const pisoDeLimite = (limite) => {
  const m = /minimum\s+(-?\d+)/i.exec(String(limite || ''))
  return m ? Number(m[1]) : 0
}

/**
 * Resuelve una fórmula en prosa contra las características del personaje.
 *
 * @param formula  p. ej. "1 + Dex modifier"
 * @param limite   contenido de uses_limit, para el piso ("minimum 1")
 * @returns número, o null si la fórmula no se reconoce
 */
const maximoEnProsa = async (formula, id_personaje, limite = '', run = query) => {
  const txt = String(formula || '').trim().toLowerCase()
  if (!txt) return null

  // Se parte en términos con su signo: "1 + dex modifier" → ['+1', '+dex modifier']
  const terminos = txt.replace(/\s*([+-])\s*/g, ' $1').split(/\s+(?=[+-])|^(?=[^+-])/)
    .map(t => t.trim()).filter(Boolean)

  let stats = null
  let total = 0
  for (const t of terminos) {
    const signo = t.startsWith('-') ? -1 : 1
    const cuerpo = t.replace(/^[+-]\s*/, '').trim()

    if (/^\d+$/.test(cuerpo)) { total += signo * Number(cuerpo); continue }

    const m = /^([a-z]{3})\s+modifier$/.exec(cuerpo)
    if (!m || !STATS_PROSA[m[1]]) return null   // término desconocido

    if (!stats) {
      const { rows } = await run(
        `SELECT * FROM "${SCHEMA}"."personaje_stats" WHERE id_personaje = $1`, [id_personaje])
      stats = rows[0] || {}
    }
    const col = STATS_PROSA[m[1]]
    const valor = (Number(stats[col]) || 0) + (Number(stats[`${col}_bonus`]) || 0)
    total += signo * Math.floor((valor - 10) / 2)
  }
  return Math.max(pisoDeLimite(limite), total)
}

module.exports = { maximoDeFormula, maximoOCero, partir, parExplicito, parDeFormula, maximoEnProsa, pisoDeLimite }
