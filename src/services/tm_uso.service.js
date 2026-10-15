// Usar un TM de la mochila para enseñarle su movimiento a un Pokémon del
// entrenador (cinturón o femputadora). El DM lo aprueba en mesa y solo se hace
// durante un long rest; eso lo confirma el jugador en el front.
//
// Candidatos: Pokémon del entrenador cuya especie admite ese TM
// (pokemon.pokemon_moves_tm) y que aún no saben el movimiento.
// Si el Pokémon ya tiene 4 movimientos (sin Struggle), debe olvidar uno.
// Confirmado, se gasta una unidad del TM; todo en una transacción.
const { query, transaction, SCHEMA } = require('../config/db')
const { numeroTm, tmsCompatibles, esStruggle, movimientosQueCuentan, debeOlvidar } = require('../lib/tm')

const T    = `"${SCHEMA}"."personaje"`
const TPP  = `"${SCHEMA}"."personaje_pokemon"`
const TPPM = `"${SCHEMA}"."personaje_pokemon_moves"`
const TEQ  = `"${SCHEMA}"."personaje_equipo"`
const TUP  = `"${SCHEMA}"."usuarios_partida"`
const TI   = `"${SCHEMA}"."items"`
const TTM  = `"${SCHEMA}"."TM"`
const TMOV = `"${SCHEMA}"."moves"`
const TDEX = `"${SCHEMA}"."pokemon"`

// El TM de la mochila, solo si es del usuario y le queda al menos uno
const leerTm = async (db, id_personaje, id_equipo, user_id, bloquear = false) => {
  const { rows } = await db.query(
    `SELECT eq.personaje_equipo_cantidad AS cantidad, i.item_name_id, i.item_name, i.item_type,
            p.nombre_personaje
       FROM ${TEQ} eq
       JOIN ${TI} i ON i.item_id = eq.id_item
       JOIN ${T} p ON p.id_personaje = eq.id_personaje
       JOIN ${TUP} up ON up.id_usuarios_partida = p.id_usuario_partida
      WHERE eq.id_personaje_equipo = $1 AND eq.id_personaje = $2 AND up.user_id = $3
      ${bloquear ? 'FOR UPDATE OF eq' : ''}`,
    [id_equipo, id_personaje, user_id])
  const it = rows[0]
  if (!it || Number(it.cantidad) < 1) return { error: 'notfound' }
  if (String(it.item_type || '').toLowerCase() !== 'tm') return { error: 'notm' }
  const numero = numeroTm(it)
  if (!numero) return { error: 'notm' }
  const { rows: mv } = await db.query(
    `SELECT m.move_id, m.move_name_id, m.move_name, m.move_type, m.move_pp
       FROM ${TTM} t JOIN ${TMOV} m ON m.move_name_id = t.tm_name_id
      WHERE t.tm_number = $1`, [numero])
  if (!mv[0]) return { error: 'notm' }
  return { item: it, numero, move: mv[0] }
}

// Pokémon del entrenador con su especie, su lista de TM y sus movimientos
const leerPokemones = async (db, id_personaje, id_personaje_pokemon = null) => {
  const params = [id_personaje]
  const filtro = id_personaje_pokemon != null ? (params.push(id_personaje_pokemon), ` AND pp.id_personaje_pokemon = $2`) : ''
  const { rows } = await db.query(
    `SELECT pp.id_personaje_pokemon, pp.pokemon_apodo, pp.pokemon_level, pp.pokemon_en_equipo, pp.pokemon_is_shiny,
            pk.pokemon_name, pk.pokemon_moves_tm, pk.pokemon_media_sprite, pk.pokemon_media_sprite_shiny
       FROM ${TPP} pp JOIN ${TDEX} pk ON pk.pokemon_id = pp.id_pokemon
      WHERE pp.id_personaje = $1${filtro}
      ORDER BY pp.pokemon_en_equipo DESC, pp.pokemon_apodo`, params)
  if (!rows.length) return []
  const { rows: moves } = await db.query(
    `SELECT pm.personaje_pokemon_moves_id AS id, pm.personaje_pokemon_moves_personaje_pokemon_id AS idpp,
            m.move_id, m.move_name_id, m.move_name, m.move_type
       FROM ${TPPM} pm JOIN ${TMOV} m ON m.move_id = pm.personaje_pokemon_moves_move_id
      WHERE pm.personaje_pokemon_moves_personaje_pokemon_id = ANY($1::int[])
      ORDER BY pm.personaje_pokemon_moves_id`, [rows.map(r => r.id_personaje_pokemon)])
  return rows.map(r => ({ ...r, moves: moves.filter(m => m.idpp === r.id_personaje_pokemon) }))
}

const puedeAprender = (p, numero, move) =>
  tmsCompatibles(p.pokemon_moves_tm).has(numero) && !p.moves.some(m => Number(m.move_id) === Number(move.move_id))

/** Lo que muestra la ventana "Entrenar TM": el movimiento y quién puede aprenderlo */
const candidatos = async (id_personaje, id_equipo, user_id) => {
  const tm = await leerTm({ query }, id_personaje, id_equipo, user_id)
  if (tm.error) return tm
  const pokemones = (await leerPokemones({ query }, id_personaje))
    .filter(p => puedeAprender(p, tm.numero, tm.move))
    .map(p => ({
      id_personaje_pokemon: p.id_personaje_pokemon,
      apodo: p.pokemon_apodo || p.pokemon_name,
      especie: p.pokemon_name,
      nivel: p.pokemon_level,
      en_equipo: !!p.pokemon_en_equipo,
      sprite: (p.pokemon_is_shiny && p.pokemon_media_sprite_shiny) || p.pokemon_media_sprite,
      // Los que puede olvidar: todos menos Struggle
      moves: movimientosQueCuentan(p.moves).map(m => ({ id: m.id, move_name: m.move_name, move_type: m.move_type })),
      debe_olvidar: debeOlvidar(p.moves),
    }))
  return { numero: tm.numero, move: { move_id: tm.move.move_id, move_name: tm.move.move_name, move_type: tm.move.move_type }, pokemones }
}

/**
 * @param body { id_personaje_pokemon, olvidar? }  olvidar = personaje_pokemon_moves_id
 * @returns { error } | { texto, aprendido, olvidado, pokemon, id_personaje_pokemon, cantidad }
 */
const usar = async (id_personaje, id_equipo, user_id, body) => transaction(async (client) => {
  const tm = await leerTm(client, id_personaje, id_equipo, user_id, true)
  if (tm.error) return tm
  const idpp = Number(body?.id_personaje_pokemon)
  if (!Number.isInteger(idpp)) return { error: 'pokemon' }
  const [p] = await leerPokemones(client, id_personaje, idpp)
  if (!p) return { error: 'pokemon' }
  if (!tmsCompatibles(p.pokemon_moves_tm).has(tm.numero)) return { error: 'incompatible' }
  if (p.moves.some(m => Number(m.move_id) === Number(tm.move.move_id))) return { error: 'yasabe' }

  let olvidado = null
  if (debeOlvidar(p.moves)) {
    const fila = p.moves.find(m => Number(m.id) === Number(body?.olvidar))
    if (!fila || esStruggle(fila)) return { error: 'olvidar' }
    await client.query(`DELETE FROM ${TPPM} WHERE personaje_pokemon_moves_id = $1`, [fila.id])
    olvidado = fila.move_name
  }

  // PP llenos con el valor del catálogo, igual que al subir de nivel
  await client.query(
    `INSERT INTO ${TPPM} (personaje_pokemon_moves_move_id, personaje_pokemon_moves_personaje_pokemon_id,
                          personaje_pokemon_moves_current_pp, personaje_pokemon_moves_max_pp)
     VALUES ($1, $2, $3, $3)`, [tm.move.move_id, idpp, Number(tm.move.move_pp) || 0])

  // El TM se gasta: la fila se queda en 0 como con los demás items de la mochila
  await client.query(
    `UPDATE ${TEQ} SET personaje_equipo_cantidad = personaje_equipo_cantidad - 1
      WHERE id_personaje_equipo = $1 AND personaje_equipo_cantidad > 0`, [id_equipo])

  const pokemon = p.pokemon_apodo || p.pokemon_name
  const tmTxt = `TM${String(tm.numero).padStart(3, '0')}`
  const texto = `${tm.item.nombre_personaje || 'Un entrenador'} usó el ${tmTxt} con ${pokemon}: aprendió ${tm.move.move_name}`
    + (olvidado ? ` y olvidó ${olvidado}.` : '.')
  return {
    texto, aprendido: tm.move.move_name, olvidado, pokemon, id_personaje_pokemon: idpp,
    cantidad: Number(tm.item.cantidad) - 1,
  }
})

module.exports = { candidatos, usar }
