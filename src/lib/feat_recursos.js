// Recursos gastables que otorga un FEAT, al estilo de los Extra Points de una
// ruta pero colgando de personaje_feat_bonus.
//
// No hay una columna que los marque: se reconocen porque su TIPO lleva la
// palabra "Points" ("Lucky Points"). El criterio vive aquí y en un solo sitio,
// porque hace falta al crear el personaje, al agregar el feat con el lápiz, al
// subirlo de nivel, al listarlos, al gastarlos, al ajustarlos con el lápiz y al
// descansar; si cada uno lo decidiera a su manera acabarían discrepando.
//
// Cómo se guarda cada fila de personaje_feat_bonus:
//
//   type   → el tipo del feats_bonus. Es el NOMBRE que se muestra.
//   llave  → la llave del feats_bonus. Nombra la tabla y el campo de donde sale
//            el MÁXIMO ("personaje.personaje_prof"), igual que las fórmulas de
//            los recursos de ruta.
//   value  → el valor ACTUAL. Al crearlo arranca en la proficiencia del
//            personaje, que es su tope.
//
// El máximo no se guarda nunca: se resuelve al leer. Un valor guardado se
// quedaría viejo en cuanto el personaje sube de nivel y le crece la
// proficiencia, y habría que acordarse de recalcularlo en cada sitio.
const { query, SCHEMA } = require('../config/db')
const { maximoOCero } = require('./recurso_formula')

const TPF  = `"${SCHEMA}"."personaje_feat"`
const TPFB = `"${SCHEMA}"."personaje_feat_bonus"`
const TFB  = `"${SCHEMA}"."feats_bonus"`
const T    = `"${SCHEMA}"."personaje"`

/** ¿Este tipo de bono es un recurso gastable por puntos? ("Lucky Points") */
const esRecurso = (type) => /points/i.test(String(type || ''))

// El otro recurso de feat: un uso de terreno.
//
// En el CATÁLOGO el bono viene con type 'Terrain' y la lista de terrenos
// elegibles en el valor, separados por coma. El jugador escoge uno y esa
// elección se guarda en la LLAVE; el valor pasa a ser el uso que le queda.
//
// Siempre es un solo uso: no hay fórmula que resolver, el máximo es 1 y vuelve
// a 1 con el descanso largo.
const esTerreno = (type) => String(type || '').trim().toLowerCase() === 'terrain'
const MAX_TERRENO = 1

/** Los terrenos elegibles de un bono del catálogo, sin repetidos ni vacíos. */
const opcionesDeTerreno = (valor) => {
  const vistos = new Set()
  const out = []
  for (const t of String(valor || '').split(',')) {
    const limpio = t.trim()
    if (!limpio) continue
    const clave = limpio.toLowerCase()
    if (vistos.has(clave)) continue   // el catálogo trae "Swamp" dos veces
    vistos.add(clave)
    out.push(limpio)
  }
  return out
}

/**
 * Filas de terreno para un feat, con el terreno que eligió el jugador.
 *
 * La elección se valida contra el catálogo: llega del cliente y no puede ser
 * cualquier texto. Sin elección válida devuelve { error: 'terreno' }, para que
 * quien llame decida si aborta o sigue.
 */
const filasDeTerreno = async (feat_id, eleccion, run = query) => {
  const { rows } = await run(
    `SELECT feats_bonus_type AS type, feats_bonus_valor AS valor
       FROM ${TFB} WHERE id_feat = $1 ORDER BY id_feats_bonus`, [feat_id])
  const terrenos = rows.filter(b => esTerreno(b.type))
  if (!terrenos.length) return []

  const filas = []
  for (const b of terrenos) {
    const opciones = opcionesDeTerreno(b.valor)
    const pedido = String(eleccion || '').trim().toLowerCase()
    const elegido = opciones.find(o => o.toLowerCase() === pedido)
    if (!elegido) return { error: 'terreno', opciones }
    filas.push({ type: 'Terrain', llave: elegido, value: String(MAX_TERRENO) })
  }
  return filas
}

/** ¿Este feat del catálogo pide elegir terreno? */
const pideTerreno = async (feat_id, run = query) => {
  const { rows } = await run(
    `SELECT 1 FROM ${TFB} WHERE id_feat = $1 AND feats_bonus_type ILIKE 'terrain' LIMIT 1`, [feat_id])
  return rows.length > 0
}

/** La proficiencia del personaje, que es con lo que arrancan estos recursos. */
const proficienciaDe = async (id_personaje, run = query) => {
  const { rows } = await run(
    `SELECT personaje_prof FROM ${T} WHERE id_personaje = $1`, [id_personaje])
  return Math.max(0, Number(rows[0]?.personaje_prof) || 0)
}

/**
 * Filas de personaje_feat_bonus que hay que crear para los bonos de recurso de
 * un feat del catálogo. Devuelve [] si el feat no tiene ninguno.
 *
 * Se consulta el catálogo en vez de fiarse de lo que mande el cliente: el valor
 * inicial es la proficiencia y eso lo decide el servidor.
 */
const filasDeRecurso = async (feat_id, id_personaje, run = query) => {
  const { rows } = await run(
    `SELECT feats_bonus_type AS type, feats_bonus_llave AS llave
       FROM ${TFB} WHERE id_feat = $1 ORDER BY id_feats_bonus`, [feat_id])
  const recursos = rows.filter(b => esRecurso(b.type))
  if (!recursos.length) return []
  const prof = await proficienciaDe(id_personaje, run)
  return recursos.map(b => ({ type: b.type, llave: b.llave, value: String(prof) }))
}

/**
 * Los recursos de feat de un entrenador, listos para pintar.
 *
 * Un feat desactivado desde la ficha —o un bono desactivado— deja de contar,
 * igual que en el resto de efectos de feats.
 */
const recursosDeFeats = async (id_personaje, run = query) => {
  const { rows } = await run(
    `SELECT fb.personaje_feat_bonus_id    AS id,
            fb.personaje_feat_bonus_type  AS nombre,
            fb.personaje_feat_bonus_llave AS columna,
            fb.personaje_feat_bonus_value AS actual,
            f.feat_id, f.feat_name, f.feat_type, f.feat_prerequisite, f.feat_benefits,
            f.feat_ability_score_increase, f.feat_is_repeatable, f.feat_notes
       FROM ${TPFB} fb
       JOIN ${TPF} pf ON pf.personaje_feat_id = fb.personaje_feat_bonus_personaje_feat_id
       JOIN "${SCHEMA}"."feats" f ON f.feat_id = pf.feat_id
      WHERE pf.personaje_id = $1
        AND (fb.personaje_feat_bonus_type ILIKE '%points%'
          OR fb.personaje_feat_bonus_type ILIKE 'terrain')
        AND COALESCE(fb.personaje_feat_bonus_is_available, TRUE)
        AND COALESCE(pf.personaje_feat_is_available, TRUE)
      ORDER BY fb.personaje_feat_bonus_id`, [id_personaje])

  return Promise.all(rows.map(async r => {
    // Los dos se llaman como el FEAT, que es lo que el jugador reconoce, y a la
    // derecha llevan el detalle: el terreno elegido en uno, el nombre del
    // recurso en el otro.
    //
    // Viaja además el feat entero: el panel deja abrir su ficha desde el nombre
    // y así no hay que ir a buscarlo por separado. Mismo criterio que los bonos
    // de ataque de los feats del Pokémon.
    const feat = {
      feat_id: r.feat_id, feat_name: r.feat_name, feat_type: r.feat_type,
      feat_prerequisite: r.feat_prerequisite, feat_benefits: r.feat_benefits,
      feat_ability_score_increase: r.feat_ability_score_increase,
      feat_is_repeatable: r.feat_is_repeatable, feat_notes: r.feat_notes,
    }
    const comun = { id: Number(r.id), nombre: r.feat_name, feat_name: r.feat_name, feat, tipo: 'feat' }

    if (esTerreno(r.nombre)) {
      return {
        ...comun,
        etiqueta: r.columna,       // el terreno elegido, que vive en la llave
        terreno: r.columna,
        actual: Math.min(MAX_TERRENO, Math.max(0, Number(r.actual) || 0)),
        maximo: MAX_TERRENO,
      }
    }
    return {
      ...comun,
      etiqueta: r.nombre,          // el nombre del recurso ("Lucky Points")
      columna: r.columna,
      actual: Math.max(0, Number(r.actual) || 0),
      maximo: await maximoOCero(r.columna, { id_personaje }, run),
    }
  }))
}

module.exports = {
  esRecurso, esTerreno, MAX_TERRENO, opcionesDeTerreno, pideTerreno,
  proficienciaDe, filasDeRecurso, filasDeTerreno, recursosDeFeats,
}
