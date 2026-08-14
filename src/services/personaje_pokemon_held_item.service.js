const { query, transaction, SCHEMA } = require('../config/db')
const { efectosDeFeats } = require('../lib/pokemon_feats')

const TPP   = `"${SCHEMA}"."personaje_pokemon"`
const TPPHI = `"${SCHEMA}"."personaje_pokemon_held_item"`
const TITEM = `"${SCHEMA}"."items"`
const TEQ   = `"${SCHEMA}"."personaje_equipo"`
const TPPF  = `"${SCHEMA}"."personaje_pokemon_feat"`
const TPPFB = `"${SCHEMA}"."personaje_pokemon_feat_bonus"`
const TFEATS= `"${SCHEMA}"."feats"`

// Un objeto equipado sale de la mochila del entrenador y vuelve a ella al
// quitarlo, así que equipar y quitar mueven DOS tablas. Todo va en transacción:
// si algo falla a mitad, el item no puede quedar duplicado ni desaparecido.

/**
 * Comprueba que el Pokémon existe y es de ese entrenador.
 * Sin esto, un id de Pokémon ajeno permitiría gastar items de otra mochila.
 */
const esSuyo = async (run, id_personaje, id_personaje_pokemon) => {
  const { rows } = await run(
    `SELECT 1 FROM ${TPP} WHERE id_personaje_pokemon = $1 AND id_personaje = $2`,
    [id_personaje_pokemon, id_personaje])
  return rows.length > 0
}

/** Fila del held item con su item ya resuelto, que es lo que pinta el panel */
const filaCompleta = async (run, id) => {
  const { rows } = await run(
    `SELECT hi.personaje_pokemon_held_item_id, i.*
       FROM ${TPPHI} hi
       JOIN ${TITEM} i ON i.item_id = hi.personaje_pokemon_held_item_id_item
      WHERE hi.personaje_pokemon_held_item_id = $1`, [id])
  return rows[0] || null
}

/** Objetos que lleva equipados un Pokémon, con los datos del item */
const findByPokemon = async (id_personaje_pokemon) => {
  const { rows } = await query(
    `SELECT hi.personaje_pokemon_held_item_id, i.*
       FROM ${TPPHI} hi
       JOIN ${TITEM} i ON i.item_id = hi.personaje_pokemon_held_item_id_item
      WHERE hi.personaje_pokemon_held_item_id_pokemon = $1
      ORDER BY hi.personaje_pokemon_held_item_id`,
    [id_personaje_pokemon])
  return rows
}

/**
 * Cuántos objetos puede llevar el Pokémon.
 *
 * Uno de base, más los que le den sus feats (regla 2: Ambidextrous). Se
 * consulta en el momento y no se guarda: si el feat se desactiva, el tope baja
 * solo.
 */
const huecosDeObjeto = async (run, id_personaje_pokemon) => {
  const { rows } = await run(
    `SELECT pf.personaje_pokemon_feat_id, pf.personaje_feat_is_available AS is_available,
            f.feat_id, f.feat_name,
            COALESCE((
              SELECT json_agg(json_build_object(
                'type',  b.personaje_pokemon_feat_bonus_type,
                'llave', b.personaje_pokemon_feat_bonus_llave,
                'value', b.personaje_pokemon_feat_bonus_value,
                'is_available', b.personaje_pokemon_feat_bonus_is_available))
              FROM ${TPPFB} b
              WHERE b.personaje_pokemon_feat_bonus_personaje_pokemon_feat_id = pf.personaje_pokemon_feat_id
            ), '[]') AS bonos
       FROM ${TPPF} pf JOIN ${TFEATS} f ON f.feat_id = pf.feat_id
      WHERE pf.id_trainer_pokemon = $1`, [id_personaje_pokemon])
  return efectosDeFeats(rows).held_item_slots
}

/**
 * Equipa un item: lo descuenta de la mochila y lo ata al Pokémon.
 *
 * El tope sale de los feats del Pokémon, no de un número fijo.
 */
const addHeldItem = (id_personaje, id_personaje_pokemon, id_item) =>
  transaction(async (client) => {
    if (!await esSuyo(client.query.bind(client), id_personaje, id_personaje_pokemon)) {
      return { error: 'notfound' }
    }

    const maximo = await huecosDeObjeto(client.query.bind(client), id_personaje_pokemon)
    const { rows: yaTiene } = await client.query(
      `SELECT count(*)::int AS n FROM ${TPPHI}
        WHERE personaje_pokemon_held_item_id_pokemon = $1`, [id_personaje_pokemon])
    if (yaTiene[0].n >= maximo) return { error: 'lleno', maximo }

    // FOR UPDATE: bloquea la fila de la mochila hasta cerrar la transacción,
    // para que dos peticiones a la vez no gasten la misma unidad dos veces.
    const { rows: eq } = await client.query(
      `SELECT id_personaje_equipo, personaje_equipo_cantidad
         FROM ${TEQ} WHERE id_personaje = $1 AND id_item = $2 FOR UPDATE`,
      [id_personaje, id_item])
    if (!eq.length) return { error: 'sinitem' }
    const cantidad = Number(eq[0].personaje_equipo_cantidad) || 0
    if (cantidad < 1) return { error: 'sinitem' }

    await client.query(
      `UPDATE ${TEQ} SET personaje_equipo_cantidad = $1 WHERE id_personaje_equipo = $2`,
      [cantidad - 1, eq[0].id_personaje_equipo])

    const { rows: ins } = await client.query(
      `INSERT INTO ${TPPHI}
         (personaje_pokemon_held_item_id_pokemon, personaje_pokemon_held_item_id_item)
       VALUES ($1, $2) RETURNING personaje_pokemon_held_item_id`,
      [id_personaje_pokemon, id_item])

    return filaCompleta(client.query.bind(client), ins[0].personaje_pokemon_held_item_id)
  })

/**
 * Quita el objeto y lo DEVUELVE a la mochila.
 *
 * Si la fila de la mochila ya no existe —porque se gastó la última unidad al
 * equipar y algo la borró— se vuelve a crear con una unidad.
 */
const removeHeldItem = (id_personaje, id_personaje_pokemon, id_held_item) =>
  transaction(async (client) => {
    const { rows: del } = await client.query(
      `DELETE FROM ${TPPHI}
        WHERE personaje_pokemon_held_item_id = $1
          AND personaje_pokemon_held_item_id_pokemon = $2
        RETURNING personaje_pokemon_held_item_id_item`,
      [id_held_item, id_personaje_pokemon])
    if (!del.length) return { error: 'notfound' }
    const id_item = del[0].personaje_pokemon_held_item_id_item

    const { rows: eq } = await client.query(
      `SELECT id_personaje_equipo, personaje_equipo_cantidad
         FROM ${TEQ} WHERE id_personaje = $1 AND id_item = $2 FOR UPDATE`,
      [id_personaje, id_item])

    if (eq.length) {
      await client.query(
        `UPDATE ${TEQ} SET personaje_equipo_cantidad = $1 WHERE id_personaje_equipo = $2`,
        [(Number(eq[0].personaje_equipo_cantidad) || 0) + 1, eq[0].id_personaje_equipo])
    } else {
      await client.query(
        `INSERT INTO ${TEQ} (id_personaje, id_item, personaje_equipo_cantidad)
         VALUES ($1, $2, 1)`, [id_personaje, id_item])
    }
    return { ok: true, devuelto: id_item }
  })

/**
 * Usa el objeto: se consume y NO vuelve a la mochila.
 *
 * Va en su propia función y su propia ruta, no como una bandera de removeHeldItem:
 * gastar un item es irreversible y no debe poder ocurrir por pasar mal un
 * parámetro.
 */
const useHeldItem = async (id_personaje_pokemon, id_held_item) => {
  const { rowCount } = await query(
    `DELETE FROM ${TPPHI}
      WHERE personaje_pokemon_held_item_id = $1
        AND personaje_pokemon_held_item_id_pokemon = $2`,
    [id_held_item, id_personaje_pokemon])
  return rowCount > 0
}

module.exports = { findByPokemon, addHeldItem, removeHeldItem, useHeldItem, huecosDeObjeto }
