// Vínculo de los Pokémon y el rasgo de ruta que lo mejora.
//
// REGLA (Commander, nivel 2)
//   Es un recurso con target 'pokemon': existe para TODOS los Pokémon del
//   entrenador, y cada uno lleva su propio contador en su fila
//   (personaje_pokemon_bond_current_points sobre personaje_pokemon_bond_points).
//
//   Al MOSTRARLO, el Pokémon cuyo vínculo tenga puntos positivos suma 1 a los
//   dos valores. Ese punto no se guarda: es del rasgo, así que aparece y
//   desaparece con él.
//
//   Además, al otorgarse el rasgo el STARTER sube 2 NIVELES de vínculo. Eso sí
//   se persiste, pero no en los puntos: se reapunta personaje_pokemon_bond al
//   bond del nivel resultante. Ver subirBondDelStarter.
//
// Sin el rasgo, los bond points no existen para ese entrenador y no se muestran.
//
// TOPE: bonds llega hasta el nivel 3 (Incredible Bond) y baja hasta -3.
const { query, SCHEMA } = require('../config/db')

const T    = `"${SCHEMA}"."personaje"`
const TPP  = `"${SCHEMA}"."personaje_pokemon"`
const TB   = `"${SCHEMA}"."bonds"`
const TPPB = `"${SCHEMA}"."personaje_path_bonus"`

// Rango que admite personaje_pokemon_bond_points: los siete niveles de bonds.
const BOND_MIN = -3, BOND_MAX = 3

// Lo que sube el rasgo: uno a todo el que califique, y dos más si es el starter.
const BONO_GENERAL = 1, BONO_STARTER = 2
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

/**
 * Deja los puntos del Pokémon acordes a su nivel de vínculo.
 *
 * bond_points es función del nivel: lo dice el catálogo. Cada vez que el nivel
 * se mueve —por el rasgo de la ruta o por el máster— los puntos tienen que
 * seguirlo, o el Pokémon acaba en Great Trust con el máximo de un Neutral.
 * El actual se repone al nuevo máximo, porque el tope acaba de cambiar.
 */
const sincronizarPuntosConNivel = async (id_personaje_pokemon, run = query, extra = 0) => {
  const { rows } = await run(
    `UPDATE ${TPP} pp
        SET personaje_pokemon_bond_points         = b.bond_points,
            personaje_pokemon_bond_current_points = b.bond_points
                                                  + CASE WHEN b.bond_level > 0 THEN $2::int ELSE 0 END
       FROM ${TB} b
      WHERE b.bond_id = pp.personaje_pokemon_bond
        AND pp.id_personaje_pokemon = $1
      RETURNING pp.personaje_pokemon_bond_points AS puntos`,
    [id_personaje_pokemon, Math.max(0, Number(extra) || 0)])
  return rows[0]?.puntos ?? null
}

/**
 * Los tres vínculos entre los que el máster puede mover a un Pokémon: el que
 * tiene ahora, el de un nivel por encima y el de un nivel por debajo.
 *
 * Se mueve de a un escalón para que el vínculo sea algo que se gana o se pierde
 * poco a poco en la mesa, no un desplegable con los siete niveles.
 */
const opcionesDeBond = async (id_personaje_pokemon, run = query) => {
  const { rows: act } = await run(
    `SELECT COALESCE(b.bond_level, 0) AS nivel, b.bond_id
       FROM ${TPP} pp LEFT JOIN ${TB} b ON b.bond_id = pp.personaje_pokemon_bond
      WHERE pp.id_personaje_pokemon = $1`, [id_personaje_pokemon])
  if (!act.length) return { error: 'notfound' }
  const nivel = Number(act[0].nivel)

  const { rows } = await run(
    `SELECT bond_id, bond_name, bond_level, bond_description
       FROM ${TB} WHERE bond_level BETWEEN $1 AND $2
      ORDER BY bond_level DESC`,
    [Math.max(BOND_MIN, nivel - 1), Math.min(BOND_MAX, nivel + 1)])
  return { actual: act[0].bond_id ?? null, nivel, opciones: rows }
}

/**
 * Mueve el vínculo a uno de esos tres. No toca los puntos: con las reglas
 * nuevas el nivel y los puntos gastables son cosas distintas.
 */
const setBondNivel = async (id_personaje, id_personaje_pokemon, bond_id, run = query) => {
  const opts = await opcionesDeBond(id_personaje_pokemon, run)
  if (opts.error) return opts
  if (!opts.opciones.some(o => Number(o.bond_id) === Number(bond_id))) {
    return { error: 'fuera_de_rango', opciones: opts.opciones }
  }
  const { rows } = await run(
    `UPDATE ${TPP} SET personaje_pokemon_bond = $3
      WHERE id_personaje_pokemon = $1 AND id_personaje = $2
      RETURNING id_personaje_pokemon`,
    [id_personaje_pokemon, id_personaje, Number(bond_id)])
  if (!rows.length) return { error: 'notfound' }
  await sincronizarPuntosConNivel(id_personaje_pokemon, run, await extraDelRasgo(id_personaje, run))

  const { rows: fin } = await run(
    `SELECT b.bond_id, b.bond_level, b.bond_name,
            pp.personaje_pokemon_bond_points AS puntos
       FROM ${TPP} pp JOIN ${TB} b ON b.bond_id = pp.personaje_pokemon_bond
      WHERE pp.id_personaje_pokemon = $1`, [id_personaje_pokemon])
  return fin[0] || { error: 'notfound' }
}

/**
 * Nombre de la ruta que le dio el rasgo de vínculo, o null si no lo tiene.
 *
 * Sirve para decir en la ficha que el vínculo viene de la ruta. Se resuelve al
 * leer y no guarda cuántos puntos aportó: los puntos se mueven a mano después,
 * así que cualquier número que guardáramos quedaría mintiendo. La nota solo
 * afirma lo que sigue siendo cierto: que el entrenador tiene el rasgo.
 */
const rutaDelBonoBond = async (id_personaje, run = query) => {
  const { rows } = await run(
    `SELECT p.path_name AS nombre
       FROM ${TPPB} pb
       JOIN ${T} pj ON pj.id_personaje = pb.personaje_path_bonus_personaje_id
       LEFT JOIN "${SCHEMA}"."paths" p ON p.path_id = pj.personaje_path
      WHERE pb.personaje_path_bonus_personaje_id = $1
        AND lower(pb.personaje_path_bonus_type) = 'resource_pokemon'
      LIMIT 1`, [id_personaje])
  return rows.length ? (rows[0].nombre || null) : null
}

// Puntos que suma el rasgo, guardados en `target` al confirmarlo. 0 si no lo tiene.
const EXTRA_DEL_RASGO = 1
const extraDelRasgo = async (id_personaje, run = query) => {
  const { rows } = await run(
    `SELECT personaje_path_bonus_target AS extra FROM ${TPPB}
      WHERE personaje_path_bonus_personaje_id = $1
        AND lower(personaje_path_bonus_type) = 'resource_pokemon'
      LIMIT 1`, [id_personaje])
  if (!rows.length) return 0
  const n = parseInt(rows[0].extra, 10)
  return Number.isFinite(n) ? Math.max(0, n) : EXTRA_DEL_RASGO
}

/** ¿La ruta del entrenador le dio el rasgo de vínculo? */
const tieneBonoBond = async (id_personaje, run = query) => {
  const { rows } = await run(
    `SELECT 1 FROM ${TPPB}
      WHERE personaje_path_bonus_personaje_id = $1
        AND lower(personaje_path_bonus_type) = 'resource_pokemon'
      LIMIT 1`, [id_personaje])
  return rows.length > 0
}

// Bond points de cada Pokémon del entrenador, ya con el punto extra del rasgo.
//
// Solo existen si el entrenador tiene el rasgo: sin él se devuelve un mapa
// vacío y la interfaz no muestra nada. El +1 se suma al vuelo a los dos valores
// cuando el vínculo del Pokémon es positivo, y nunca se guarda.
//
// `soloPreview` omite la comprobación del rasgo, para anticiparlo en la ventana
// de subida de nivel.
const calcular = async (id_personaje, run, soloPreview = false) => {
  const extra = soloPreview ? EXTRA_DEL_RASGO : await extraDelRasgo(id_personaje, run)
  if (!extra && !soloPreview) return []

  const { rows } = await run(
    `SELECT pp.id_personaje_pokemon                        AS id,
            pp.pokemon_apodo                               AS apodo,
            COALESCE(pp.personaje_pokemon_bond_current_points, 0) AS actual,
            COALESCE(pp.personaje_pokemon_bond_points, 0)         AS maximo,
            COALESCE(b.bond_level, 0)                      AS nivel,
            b.bond_name                                    AS nombre,
            (lower(coalesce(pp.pokemon_tag, '')) = 'starter') AS es_starter
       FROM ${TPP} pp
       LEFT JOIN ${TB} b ON b.bond_id = pp.personaje_pokemon_bond
      WHERE pp.id_personaje = $1
      ORDER BY es_starter DESC, b.bond_level DESC NULLS LAST, pp.pokemon_apodo`,
    [id_personaje])

  return rows.map(r => {
    // El punto del rasgo entra en el POOL: amplía el máximo y se gasta como
    // cualquier otro. Solo lo reciben los de vínculo positivo. El actual va tal
    // cual está guardado, porque ya incluye ese punto tras reponerse.
    const suma = Number(r.nivel) > 0 ? (extra || EXTRA_DEL_RASGO) : 0
    return {
      id: Number(r.id), apodo: r.apodo,
      nivel: Number(r.nivel), nombre: r.nombre,
      es_starter: !!r.es_starter,
      actual: Number(r.actual),
      maximo: Number(r.maximo) + suma,
      extra: suma,
    }
  })
}

/**
 * Sube el NIVEL de vínculo del starter, sin tocar sus puntos.
 *
 * Commander da +2 niveles al starter. No se suman puntos: se lee el bond_level
 * que tiene hoy, se le suman los niveles y se reapunta personaje_pokemon_bond al
 * bond de ese nivel. El tope es el más alto del catálogo (3, Incredible Bond);
 * en la práctica no debería alcanzarse, pero se recorta por si acaso.
 *
 * El starter es el que lleva pokemon_tag = 'starter'.
 */
const subirBondDelStarter = async (id_personaje, niveles = 2, run = query) => {
  const { rows } = await run(
    `SELECT pp.id_personaje_pokemon AS id, pp.pokemon_apodo AS apodo,
            COALESCE(b.bond_level, 0) AS nivel
       FROM ${TPP} pp
       LEFT JOIN ${TB} b ON b.bond_id = pp.personaje_pokemon_bond
      WHERE pp.id_personaje = $1
        AND lower(coalesce(pp.pokemon_tag, '')) = 'starter'
      LIMIT 1`, [id_personaje])
  const starter = rows[0]
  if (!starter) return null

  const nuevo = Math.min(BOND_MAX, Number(starter.nivel) + niveles)
  if (nuevo === Number(starter.nivel)) return { ...starter, nivel_nuevo: nuevo, cambio: false }

  const { rows: destino } = await run(
    `SELECT bond_id, bond_name FROM ${TB} WHERE bond_level = $1 LIMIT 1`, [nuevo])
  if (!destino[0]) return null

  await run(
    `UPDATE ${TPP} SET personaje_pokemon_bond = $2 WHERE id_personaje_pokemon = $1`,
    [starter.id, destino[0].bond_id])
  await sincronizarPuntosConNivel(starter.id, run, await extraDelRasgo(id_personaje, run))
  return {
    id: starter.id, apodo: starter.apodo,
    nivel: Number(starter.nivel), nivel_nuevo: nuevo,
    nombre: destino[0].bond_name, cambio: true,
  }
}

/** Map(id_personaje_pokemon → { actual, maximo, extra }) o vacío si no hay rasgo */
const bondExtraDelPersonaje = async (id_personaje, run = query) => {
  const filas = await calcular(id_personaje, run, false)
  return new Map(filas.map(f => [f.id, { actual: f.actual, maximo: f.maximo, extra: f.extra }]))
}

/** Vista previa para la ventana de subida de nivel, antes de persistir nada */
const previewBond = (id_personaje, run = query) => calcular(id_personaje, run, true)

/** Máximo efectivo: los puntos del nivel más el extra del rasgo, si aplica */
const maximoDeBond = async (id_personaje, id_personaje_pokemon, run = query) => {
  const extra = await extraDelRasgo(id_personaje, run)
  const { rows } = await run(
    `SELECT COALESCE(pp.personaje_pokemon_bond_points, 0) AS puntos,
            COALESCE(pp.personaje_pokemon_bond_current_points, 0) AS actual,
            COALESCE(b.bond_level, 0) AS nivel
       FROM ${TPP} pp LEFT JOIN ${TB} b ON b.bond_id = pp.personaje_pokemon_bond
      WHERE pp.id_personaje_pokemon = $1 AND pp.id_personaje = $2`,
    [id_personaje_pokemon, id_personaje])
  if (!rows.length) return null
  const r = rows[0]
  return {
    actual: Number(r.actual),
    maximo: Number(r.puntos) + (Number(r.nivel) > 0 ? extra : 0),
  }
}

/** Gasta puntos de vínculo. Nunca baja de 0. */
const spendBondPoints = async (id_personaje, id_personaje_pokemon, cantidad, run = query) => {
  const n = Math.max(1, Math.floor(Number(cantidad) || 1))
  const cur = await maximoDeBond(id_personaje, id_personaje_pokemon, run)
  if (!cur) return { error: 'notfound' }
  if (cur.actual < n) return { error: 'insufficient', ...cur }
  const actual = cur.actual - n
  await run(`UPDATE ${TPP} SET personaje_pokemon_bond_current_points = $2 WHERE id_personaje_pokemon = $1`,
    [id_personaje_pokemon, actual])
  return { actual, maximo: cur.maximo }
}

/** Fija los puntos a mano (el lápiz). Se acota entre 0 y el máximo efectivo. */
const setBondPoints = async (id_personaje, id_personaje_pokemon, valor, run = query) => {
  const cur = await maximoDeBond(id_personaje, id_personaje_pokemon, run)
  if (!cur) return { error: 'notfound' }
  const actual = Math.min(Math.max(0, Math.floor(Number(valor) || 0)), cur.maximo)
  await run(`UPDATE ${TPP} SET personaje_pokemon_bond_current_points = $2 WHERE id_personaje_pokemon = $1`,
    [id_personaje_pokemon, actual])
  return { actual, maximo: cur.maximo }
}

module.exports = {
  tieneBonoBond, rutaDelBonoBond, bondExtraDelPersonaje, previewBond,
  sincronizarBond, sincronizarBondSeguro, setBondNivel, opcionesDeBond, subirBondDelStarter,
  sincronizarPuntosConNivel, spendBondPoints, setBondPoints, extraDelRasgo, BOND_MIN, BOND_MAX,
}
