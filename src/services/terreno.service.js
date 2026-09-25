// Terreno de cada entrenador y de sus Pokémon (columnas personaje_terreno y
// personaje_pokemon_terreno). Los NPC y Pokémon del máster no tienen.
//
// La lista de terrenos válidos sale del catálogo del feat que los ofrece
// (bono 'Terrain'), la misma que usa el rasgo de cuna: así hay una sola fuente
// y agregar un terreno allí lo habilita aquí.
const { query, SCHEMA } = require('../config/db')
const { opcionesDeTerreno } = require('../lib/feat_recursos')

const T    = `"${SCHEMA}"."personaje"`
const TPP  = `"${SCHEMA}"."personaje_pokemon"`
const TUP  = `"${SCHEMA}"."usuarios_partida"`
const TFB  = `"${SCHEMA}"."feats_bonus"`

const listar = async () => {
  const { rows } = await query(
    `SELECT feats_bonus_valor AS valor FROM ${TFB} WHERE feats_bonus_type ILIKE 'terrain'`)
  const vistos = new Set(), out = []
  for (const r of rows) for (const t of opcionesDeTerreno(r.valor)) {
    if (!vistos.has(t.toLowerCase())) { vistos.add(t.toLowerCase()); out.push(t) }
  }
  return out
}

// null/'' = sin terreno. Devuelve el nombre canónico del catálogo, o
// { error: 'invalido' } si no existe.
const resolver = async (terreno) => {
  const limpio = String(terreno ?? '').trim()
  if (!limpio) return { valor: null }
  const hallado = (await listar()).find(t => t.toLowerCase() === limpio.toLowerCase())
  return hallado ? { valor: hallado } : { error: 'invalido' }
}

// Solo si el personaje pertenece a esa partida: el máster administra la suya.
const setPersonaje = async (id_partida, id_personaje, terreno) => {
  const r = await resolver(terreno); if (r.error) return r
  const { rows } = await query(
    `UPDATE ${T} p SET personaje_terreno = $3
       FROM ${TUP} up
      WHERE up.id_usuarios_partida = p.id_usuario_partida
        AND up.id_partida = $1 AND p.id_personaje = $2
      RETURNING p.id_personaje, p.personaje_terreno`,
    [id_partida, id_personaje, r.valor])
  return rows[0] || { error: 'notfound' }
}

const setPokemon = async (id_partida, id_personaje_pokemon, terreno) => {
  const r = await resolver(terreno); if (r.error) return r
  const { rows } = await query(
    `UPDATE ${TPP} pp SET personaje_pokemon_terreno = $3
       FROM ${T} p JOIN ${TUP} up ON up.id_usuarios_partida = p.id_usuario_partida
      WHERE p.id_personaje = pp.id_personaje
        AND up.id_partida = $1 AND pp.id_personaje_pokemon = $2
      RETURNING pp.id_personaje_pokemon, pp.personaje_pokemon_terreno`,
    [id_partida, id_personaje_pokemon, r.valor])
  return rows[0] || { error: 'notfound' }
}

// Masivo: null deja a todos sin terreno, un nombre se lo pone a todos.
// Los Pokémon que no están en el equipo también, para que no reaparezcan con
// uno viejo al volver a entrar.
const setTodos = async (id_partida, terreno) => {
  const r = await resolver(terreno); if (r.error) return r
  await query(
    `UPDATE ${T} p SET personaje_terreno = $2
       FROM ${TUP} up
      WHERE up.id_usuarios_partida = p.id_usuario_partida AND up.id_partida = $1`,
    [id_partida, r.valor])
  await query(
    `UPDATE ${TPP} pp SET personaje_pokemon_terreno = $2
       FROM ${T} p JOIN ${TUP} up ON up.id_usuarios_partida = p.id_usuario_partida
      WHERE p.id_personaje = pp.id_personaje AND up.id_partida = $1`,
    [id_partida, r.valor])
  return { terreno: r.valor }
}

module.exports = { listar, setPersonaje, setPokemon, setTodos }
