// Bono de vínculo que la ruta del entrenador otorga a sus Pokémon.
//
// REGLA
//   El rasgo con target 'positive_bond_pokemon' (hoy: Commander, nivel 2) sube
//   el nivel de vínculo, pero SOLO a los Pokémon que ya lo tienen positivo: uno
//   Neutral (0) o peor no gana nada, la ruta premia el vínculo existente.
//   El starter del entrenador sube 2 en vez de 1.
//
// Se calcula al leer y no se persiste: el starter puede cambiar, un Pokémon
// puede subir o bajar de vínculo, y el bono debe alcanzar también a los que
// lleguen después. Guardar el número lo dejaría obsoleto en silencio.
//
// TOPE: bonds llega hasta el nivel 3 (Incredible Bond). Un +1 sobre un 3 no
// tiene fila que mostrar, así que se recorta ahí.
const { query, SCHEMA } = require('../config/db')

const T    = `"${SCHEMA}"."personaje"`
const TPP  = `"${SCHEMA}"."personaje_pokemon"`
const TB   = `"${SCHEMA}"."bonds"`
const TPPB = `"${SCHEMA}"."personaje_path_bonus"`

/** ¿La ruta del entrenador le dio el rasgo de vínculo? */
const tieneBonoBond = async (id_personaje, run = query) => {
  const { rows } = await run(
    `SELECT 1 FROM ${TPPB}
      WHERE personaje_path_bonus_personaje_id = $1
        AND lower(personaje_path_bonus_type) = 'bond_bonus'
      LIMIT 1`, [id_personaje])
  return rows.length > 0
}

// Cuánto sube cada Pokémon y a qué nivel queda. `soloPreview` omite la
// comprobación del rasgo, para poder anticiparlo en la ventana de subida.
const calcular = async (id_personaje, run, soloPreview = false) => {
  if (!soloPreview && !(await tieneBonoBond(id_personaje, run))) return []
  const { rows } = await run(
    `SELECT pp.id_personaje_pokemon AS id,
            pp.pokemon_apodo        AS apodo,
            b.bond_level            AS nivel,
            b.bond_name             AS nombre,
            (pp.id_personaje_pokemon = p.personaje_starter_pokemon_id) AS es_starter,
            (SELECT MAX(bond_level) FROM ${TB})                        AS tope
       FROM ${TPP} pp
       JOIN ${T} p ON p.id_personaje = pp.id_personaje
       JOIN ${TB} b ON b.bond_id = pp.personaje_pokemon_bond
      WHERE pp.id_personaje = $1
        AND b.bond_level > 0          -- solo los que ya tienen vínculo positivo
      ORDER BY es_starter DESC, b.bond_level DESC, pp.pokemon_apodo`,
    [id_personaje]
  )
  return rows.map(r => {
    const sube  = r.es_starter ? 2 : 1
    const tope  = Number(r.tope) || 3
    const nuevo = Math.min(Number(r.nivel) + sube, tope)
    return {
      id: Number(r.id), apodo: r.apodo,
      nivel: Number(r.nivel), nombre: r.nombre,
      es_starter: !!r.es_starter,
      // Lo que realmente sube tras recortar en el tope
      extra: nuevo - Number(r.nivel),
      nivel_nuevo: nuevo,
    }
  }).filter(x => x.extra > 0)
}

/** Map(id_personaje_pokemon → { extra, nivel_nuevo }) para el que ya lo tiene */
const bondExtraDelPersonaje = async (id_personaje, run = query) => {
  const filas = await calcular(id_personaje, run, false)
  return new Map(filas.map(f => [f.id, { extra: f.extra, nivel_nuevo: f.nivel_nuevo }]))
}

/** Vista previa para la ventana de subida de nivel, antes de persistir nada */
const previewBond = (id_personaje, run = query) => calcular(id_personaje, run, true)

module.exports = { tieneBonoBond, bondExtraDelPersonaje, previewBond }
