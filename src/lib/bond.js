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

// Rango que admite personaje_pokemon_bond_points: los siete niveles de bonds.
const BOND_MIN = -3, BOND_MAX = 3
const acotar = n => Math.max(BOND_MIN, Math.min(BOND_MAX, Math.floor(Number(n) || 0)))

/**
 * Pone personaje_pokemon_bond en el bond cuyo bond_level coincide con los
 * puntos del Pokémon. El emparejamiento va contra bond_level y no contra
 * bonds.bond_points porque los niveles negativos tienen 0 puntos en el
 * catálogo: por ahí, -1, -2 y -3 serían indistinguibles.
 *
 * Se llama tras cualquier cambio de puntos: edición manual, subida de nivel del
 * Pokémon o del entrenador.
 *
 * @param filtro { id_personaje } o { id_personaje_pokemon }
 */
const sincronizarBond = async (filtro, run = query) => {
  const porPokemon = filtro?.id_personaje_pokemon != null
  const { rows } = await run(
    `UPDATE ${TPP} pp
        SET personaje_pokemon_bond = b.bond_id
       FROM ${TB} b
      WHERE b.bond_level = LEAST(GREATEST(pp.personaje_pokemon_bond_points, $2), $3)
        AND pp.${porPokemon ? 'id_personaje_pokemon' : 'id_personaje'} = $1
        AND pp.personaje_pokemon_bond IS DISTINCT FROM b.bond_id
      RETURNING pp.id_personaje_pokemon, b.bond_id, b.bond_name`,
    [porPokemon ? filtro.id_personaje_pokemon : filtro.id_personaje, BOND_MIN, BOND_MAX])
  return rows
}

// Igual que la anterior pero sin tumbar la operación principal si algo falla
const sincronizarBondSeguro = async (filtro, run = query) => {
  try { return await sincronizarBond(filtro, run) } catch (e) {
    console.error('sincronizarBond:', e.message); return []
  }
}

/** Fija los puntos de vínculo a mano y deja el nivel en su sitio */
const setBondPoints = async (id_personaje, id_personaje_pokemon, puntosRaw, run = query) => {
  const puntos = acotar(puntosRaw)
  const { rows } = await run(
    `UPDATE ${TPP} SET personaje_pokemon_bond_points = $3
      WHERE id_personaje_pokemon = $1 AND id_personaje = $2
      RETURNING id_personaje_pokemon`,
    [id_personaje_pokemon, id_personaje, puntos])
  if (!rows.length) return { error: 'notfound' }
  await sincronizarBond({ id_personaje_pokemon }, run)
  const { rows: fin } = await run(
    `SELECT pp.personaje_pokemon_bond_points AS puntos, b.bond_id, b.bond_level, b.bond_name
       FROM ${TPP} pp LEFT JOIN ${TB} b ON b.bond_id = pp.personaje_pokemon_bond
      WHERE pp.id_personaje_pokemon = $1`, [id_personaje_pokemon])
  return fin[0] || { error: 'notfound' }
}

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
  // Se mira personaje_pokemon_bond_points, que es la fuente de verdad del
  // vínculo; personaje_pokemon_bond es su reflejo y lo pone sincronizarBond().
  const { rows } = await run(
    `SELECT pp.id_personaje_pokemon         AS id,
            pp.pokemon_apodo                AS apodo,
            pp.personaje_pokemon_bond_points AS nivel,
            b.bond_name                     AS nombre,
            (lower(coalesce(pp.pokemon_tag, '')) = 'starter') AS es_starter,
            $2::int                         AS tope
       FROM ${TPP} pp
       JOIN ${T} p ON p.id_personaje = pp.id_personaje
       LEFT JOIN ${TB} b ON b.bond_id = pp.personaje_pokemon_bond
      WHERE pp.id_personaje = $1
        -- El starter entra siempre; el resto solo si su vínculo ya es positivo.
        -- Sin la excepción el bono no haría nada en la práctica: Commander llega
        -- en el nivel 2 y a esas alturas todos suelen estar en 0.
        AND (lower(coalesce(pp.pokemon_tag, '')) = 'starter'
             OR pp.personaje_pokemon_bond_points > 0)
      ORDER BY es_starter DESC, pp.personaje_pokemon_bond_points DESC, pp.pokemon_apodo`,
    [id_personaje, BOND_MAX]
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

/**
 * Aplica el bono de la ruta a los puntos de vínculo y deja el nivel al día.
 * Se llama al otorgar el rasgo: a partir de ahí los puntos son un valor propio
 * del Pokémon, que el máster puede seguir moviendo a mano.
 */
const aplicarBonoBond = async (id_personaje, run = query) => {
  const filas = await calcular(id_personaje, run, true)
  for (const f of filas) {
    if (f.extra <= 0) continue
    await run(
      `UPDATE ${TPP} SET personaje_pokemon_bond_points = LEAST($2, personaje_pokemon_bond_points + $3)
        WHERE id_personaje_pokemon = $1`, [f.id, BOND_MAX, f.extra])
  }
  await sincronizarBond({ id_personaje }, run)
  return filas
}

/** Map(id_personaje_pokemon → { extra, nivel_nuevo }) para el que ya lo tiene */
const bondExtraDelPersonaje = async (id_personaje, run = query) => {
  const filas = await calcular(id_personaje, run, false)
  return new Map(filas.map(f => [f.id, { extra: f.extra, nivel_nuevo: f.nivel_nuevo }]))
}

/** Vista previa para la ventana de subida de nivel, antes de persistir nada */
const previewBond = (id_personaje, run = query) => calcular(id_personaje, run, true)

module.exports = {
  tieneBonoBond, bondExtraDelPersonaje, previewBond,
  sincronizarBond, sincronizarBondSeguro, setBondPoints, aplicarBonoBond, BOND_MIN, BOND_MAX,
}
