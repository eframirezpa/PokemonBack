// Usar un item de medicina/baya que cura HP: elige objetivo (cualquier
// entrenador o Pokémon de la party), valida la tirada, cura sin pasar del HP
// máximo real y gasta una unidad, todo en una transacción.
const { query, transaction, SCHEMA } = require('../config/db')
const personajeSvc = require('./personaje.service')
const { parseCuracion, parsePP, parseEstado } = require('../lib/item_curacion')
const TPPM = `"${SCHEMA}"."personaje_pokemon_moves"`

const T   = `"${SCHEMA}"."personaje"`
const TPP = `"${SCHEMA}"."personaje_pokemon"`
const TEQ = `"${SCHEMA}"."personaje_equipo"`
const TUP = `"${SCHEMA}"."usuarios_partida"`
const TI  = `"${SCHEMA}"."items"`

/**
 * @param user_id      quien usa el item (debe ser el dueño del personaje)
 * @param destino      { tipo: 'personaje'|'pokemon', id_personaje, id_personaje_pokemon? }
 * @param tirada       resultado de los dados (solo si el item los lleva)
 * @returns { error } | { curado, hp, hpMax, objetivo, cantidad }
 */
const usar = async (id_personaje, id_equipo, user_id, destino, tirada) => {
  const { rows } = await query(
    `SELECT eq.personaje_equipo_cantidad AS cantidad, i.item_type, i.item_description, i.item_name,
            up.id_partida
       FROM ${TEQ} eq
       JOIN ${TI} i ON i.item_id = eq.id_item
       JOIN ${T} p ON p.id_personaje = eq.id_personaje
       JOIN ${TUP} up ON up.id_usuarios_partida = p.id_usuario_partida
      WHERE eq.id_personaje_equipo = $1 AND eq.id_personaje = $2 AND up.user_id = $3`,
    [id_equipo, id_personaje, user_id])
  const it = rows[0]
  if (!it || Number(it.cantidad) < 1) return { error: 'notfound' }

  const pp = parsePP(it)
  if (pp) return usarPP(id_equipo, it, pp, destino)

  const est = parseEstado(it)
  if (est) return usarEstado(id_equipo, it, est, destino)

  const cura = parseCuracion(it)
  if (!cura) return { error: 'noaplica' }

  // La party de la mesa: de ahí sale el HP máximo real y se valida que el
  // objetivo sea de esta partida.
  const party = await personajeSvc.findParty(it.id_partida)
  const dueno = party.find(c => Number(c.id_personaje) === Number(destino?.id_personaje))
  if (!dueno) return { error: 'objetivo' }

  const esPokemon = destino.tipo === 'pokemon'
  const pk = esPokemon
    ? dueno.pokemons.find(p => Number(p.id_personaje_pokemon) === Number(destino.id_personaje_pokemon))
    : null
  if (esPokemon && !pk) return { error: 'objetivo' }

  const max = Number(esPokemon ? pk.pokemon_hp : dueno.personaje_hp) || 0
  const actual = Number((esPokemon ? pk.pokemon_current_hp : dueno.personaje_current_hp) ?? max)
  const debilitado = actual <= 0

  if (cura.revive && (!esPokemon || !debilitado)) return { error: 'revive' }
  if (!cura.revive && esPokemon && debilitado) return { error: 'debilitado' }

  let curado = cura.fijo
  if (cura.dados) {
    curado = Number(tirada)
    if (!Number.isInteger(curado) || curado < cura.min || curado > cura.max) return { error: 'tirada', min: cura.min, max: cura.max }
  }
  const nuevo = Math.min(max, actual + curado)

  return transaction(async (client) => {
    const gasto = await client.query(
      `UPDATE ${TEQ} SET personaje_equipo_cantidad = personaje_equipo_cantidad - 1
        WHERE id_personaje_equipo = $1 AND personaje_equipo_cantidad > 0`, [id_equipo])
    if (!gasto.rowCount) return { error: 'notfound' }
    if (esPokemon) {
      await client.query(`UPDATE ${TPP} SET pokemon_current_hp = $1 WHERE id_personaje_pokemon = $2`, [nuevo, pk.id_personaje_pokemon])
    } else {
      await client.query(`UPDATE ${T} SET personaje_current_hp = $1 WHERE id_personaje = $2`, [nuevo, dueno.id_personaje])
    }
    return {
      curado: nuevo - actual, hp: nuevo, hpMax: max, cantidad: Number(it.cantidad) - 1,
      objetivo: esPokemon ? (pk.pokemon_apodo || 'Pokémon') : (dueno.nombre_personaje || 'Jugador'),
    }
  })
}

// Devuelve PP a un movimiento (o a todos) de un Pokémon de la party. No pasa del
// máximo; los movimientos con max 0 son ilimitados y no cuentan. Si no habría
// ningún cambio se rechaza, para no gastar el item en balde.
const usarPP = async (id_equipo, it, pp, destino) => {
  const party = await personajeSvc.findParty(it.id_partida)
  const dueno = party.find(c => Number(c.id_personaje) === Number(destino?.id_personaje))
  const pk = dueno?.pokemons.find(p => Number(p.id_personaje_pokemon) === Number(destino?.id_personaje_pokemon))
  if (!pk) return { error: 'objetivo' }

  const { rows: moves } = await query(
    `SELECT personaje_pokemon_moves_id AS id, personaje_pokemon_moves_current_pp AS cur,
            personaje_pokemon_moves_max_pp AS max
       FROM ${TPPM} WHERE personaje_pokemon_moves_personaje_pokemon_id = $1`, [pk.id_personaje_pokemon])
  let elegidos = moves.filter(m => Number(m.max) > 0)
  if (!pp.todos) {
    elegidos = elegidos.filter(m => Number(m.id) === Number(destino?.id_move))
    if (!elegidos.length) return { error: 'move' }
  }
  elegidos = elegidos.filter(m => Number(m.cur) < Number(m.max))
  if (!elegidos.length) return { error: 'lleno' }

  return transaction(async (client) => {
    const gasto = await client.query(
      `UPDATE ${TEQ} SET personaje_equipo_cantidad = personaje_equipo_cantidad - 1
        WHERE id_personaje_equipo = $1 AND personaje_equipo_cantidad > 0`, [id_equipo])
    if (!gasto.rowCount) return { error: 'notfound' }
    let restaurado = 0
    for (const m of elegidos) {
      const nuevo = Math.min(Number(m.max), Number(m.cur) + pp.cantidad)
      restaurado += nuevo - Number(m.cur)
      await client.query(`UPDATE ${TPPM} SET personaje_pokemon_moves_current_pp = $1 WHERE personaje_pokemon_moves_id = $2`, [nuevo, m.id])
    }
    return { tipoEfecto: 'pp', restaurado, movimientos: elegidos.length, cantidad: Number(it.cantidad) - 1,
      objetivo: pk.pokemon_apodo || 'Pokémon' }
  })
}

// Quita estados alterados a un entrenador o Pokémon de la party. Si el objetivo
// no tiene ninguno de los que cura el item se rechaza, para no gastarlo en balde.
const usarEstado = async (id_equipo, it, est, destino) => {
  const party = await personajeSvc.findParty(it.id_partida)
  const dueno = party.find(c => Number(c.id_personaje) === Number(destino?.id_personaje))
  const esPokemon = destino?.tipo === 'pokemon'
  const pk = esPokemon
    ? dueno?.pokemons.find(p => Number(p.id_personaje_pokemon) === Number(destino.id_personaje_pokemon)) : null
  if (!dueno || (esPokemon && !pk)) return { error: 'objetivo' }

  const tiene = String((esPokemon ? pk.personaje_pokemon_estados : dueno.personaje_estados) ?? '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean)

  let quitar
  if (est.modo === 'todos') quitar = tiene
  else if (est.modo === 'uno') quitar = tiene.filter(e => e === String(destino?.estado || '').toLowerCase())
  else quitar = tiene.filter(e => est.estados.includes(e))
  if (est.modo === 'uno' && !destino?.estado) return { error: 'estado' }
  if (!quitar.length) return { error: 'sinEstado' }

  const quedan = tiene.filter(e => !quitar.includes(e))
  return transaction(async (client) => {
    const gasto = await client.query(
      `UPDATE ${TEQ} SET personaje_equipo_cantidad = personaje_equipo_cantidad - 1
        WHERE id_personaje_equipo = $1 AND personaje_equipo_cantidad > 0`, [id_equipo])
    if (!gasto.rowCount) return { error: 'notfound' }
    const valor = quedan.length ? quedan.join(',') : null
    if (esPokemon) {
      await client.query(`UPDATE ${TPP} SET personaje_pokemon_estados = $1 WHERE id_personaje_pokemon = $2`, [valor, pk.id_personaje_pokemon])
    } else {
      await client.query(`UPDATE ${T} SET personaje_estados = $1 WHERE id_personaje = $2`, [valor, dueno.id_personaje])
    }
    return { tipoEfecto: 'estado', curados: quitar, cantidad: Number(it.cantidad) - 1,
      objetivo: esPokemon ? (pk.pokemon_apodo || 'Pokémon') : (dueno.nombre_personaje || 'Jugador') }
  })
}

module.exports = { usar }
