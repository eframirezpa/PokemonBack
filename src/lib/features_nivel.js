// Features de nivel del entrenador que se gastan y se reponen: Pokemon Tracker
// (nivel 13) y Master Trainer (nivel 20).
//
// Se comportan como los recursos de los feats, pero NO viven en
// personaje_feat_bonus: son features del nivel, así que su contador es una
// columna del propio personaje. De ahí que tengan su propia lectura y sus
// propias rutas, aunque en el panel se pinten con el mismo control.
//
// Las dos son idénticas salvo por el nivel, el tope, el nombre y la columna,
// así que van en una tabla y no en dos bloques de código gemelos.
const { query, SCHEMA } = require('../config/db')

const SKILL_ANIMAL_HANDLING = 2   // juego.skills — la expertise que da el Tracker

const FEATURES = [
  {
    clave: 'tracker',
    nombre: 'Pokemon Tracker',
    nivel: 13,
    maximo: 1,
    columna: 'personaje_pokemon_tracker',
    texto: 'Once per long rest you may search for Pokémon in the nearby area. ' +
           'You learn a list of wild Pokémon that can be found in the nearby area',
    // Al confirmarla se gana además expertise en esta habilidad
    skill_expertise: SKILL_ANIMAL_HANDLING,
  },
  {
    clave: 'master',
    nombre: 'Master Trainer',
    nivel: 20,
    maximo: 2,
    columna: 'personaje_master_trainer',
    texto: 'When you or your Pokémon fail a saving throw, you may choose to succeed instead. ' +
           'This feature can be used twice per long rest.',
    skill_expertise: null,
  },
]

const porClave  = (clave)  => FEATURES.find(f => f.clave === clave) || null
const porNombre = (nombre) => FEATURES.find(f =>
  f.nombre.toLowerCase() === String(nombre ?? '').toLowerCase().trim()) || null

// Tenerla se decide por el NIVEL y no por el contador: el contador baja a 0 al
// gastarla, así que usarlo como marca la haría desaparecer justo al usarla.
const laTiene = (f, personaje_level) => (Number(personaje_level) || 0) >= f.nivel

const leer = async (id_personaje, f, run = query) => {
  // La columna sale de la tabla de arriba, nunca de la petición
  const { rows } = await run(
    `SELECT personaje_level, COALESCE("${f.columna}", 0) AS actual
       FROM "${SCHEMA}"."personaje" WHERE id_personaje = $1`, [id_personaje])
  return rows[0] || null
}

/**
 * Las features que el entrenador ya tiene, con la forma que espera el panel.
 *
 * Cada una lleva un `feat` de mentira para que el popup de información sirva sin
 * cambios: la ventana que muestra los rasgos ya sabe pintar nombre y
 * beneficios, y duplicarla solo para esto no aportaría nada.
 */
const recursosDeNivel = async (id_personaje, run = query) => {
  const out = []
  for (const f of FEATURES) {
    const fila = await leer(id_personaje, f, run)
    if (!fila || !laTiene(f, fila.personaje_level)) continue
    out.push({
      id: `${f.clave}-${id_personaje}`,   // no es una fila de bono: la clave es sintética
      clave: f.clave,
      nombre: f.nombre,
      actual: Math.min(f.maximo, Math.max(0, Number(fila.actual) || 0)),
      maximo: f.maximo,
      tipo: 'feature',
      feat: { feat_name: f.nombre, feat_benefits: f.texto },
    })
  }
  return out
}

/** Gasta un uso. Nunca baja de 0. */
const gastarFeature = async (id_personaje, clave) => {
  const f = porClave(clave)
  if (!f) return { error: 'notfound' }
  const fila = await leer(id_personaje, f)
  if (!fila || !laTiene(f, fila.personaje_level)) return { error: 'notfound' }
  const actual = Number(fila.actual) || 0
  if (actual < 1) return { error: 'insufficient', actual: 0 }
  await query(
    `UPDATE "${SCHEMA}"."personaje" SET "${f.columna}" = $2 WHERE id_personaje = $1`,
    [id_personaje, actual - 1])
  return { actual: actual - 1, maximo: f.maximo }
}

/** Fija el valor (el lápiz). Se corta entre 0 y su tope. */
const fijarFeature = async (id_personaje, clave, valorRaw) => {
  const f = porClave(clave)
  if (!f) return { error: 'notfound' }
  const fila = await leer(id_personaje, f)
  if (!fila || !laTiene(f, fila.personaje_level)) return { error: 'notfound' }
  const actual = Math.min(f.maximo, Math.max(0, Math.floor(Number(valorRaw) || 0)))
  await query(
    `UPDATE "${SCHEMA}"."personaje" SET "${f.columna}" = $2 WHERE id_personaje = $1`,
    [id_personaje, actual])
  return { actual, maximo: f.maximo }
}

/**
 * Repone las que tenga, dentro de la transacción del descanso largo.
 *
 * Solo a quien ya tenga la feature: en los demás la columna sigue en 0 y
 * rellenarla les daría usos que no les corresponden.
 */
const reponerFeatures = async (run, id_personaje, personaje_level) => {
  let repuestas = 0
  for (const f of FEATURES) {
    if (!laTiene(f, personaje_level)) continue
    await run(
      `UPDATE "${SCHEMA}"."personaje" SET "${f.columna}" = $2 WHERE id_personaje = $1`,
      [id_personaje, f.maximo])
    repuestas++
  }
  return repuestas
}

module.exports = {
  FEATURES, SKILL_ANIMAL_HANDLING,
  porClave, porNombre, laTiene,
  recursosDeNivel, gastarFeature, fijarFeature, reponerFeatures,
}
