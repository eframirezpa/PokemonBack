// Quién está invocado en el campo de la partida (Pokémon y NPC del máster).
//
// Antes esto vivía solo en memoria del navegador y se repartía por broadcast:
// al recargar o reconectar se perdía. Esta tabla guarda el hecho de "está
// invocado ahora" y sus banderas por instancia (oculto, en la pokébola); el
// HP y el resto de datos siguen viviendo donde ya vivían (master_pokemon,
// master_npc) y se leen aparte.
const { query, SCHEMA } = require('../config/db')

const TC  = `"${SCHEMA}"."master_campo"`
const TMP = `"${SCHEMA}"."master_pokemon"`
const TN  = `"${SCHEMA}"."master_npc"`
const TP  = `"${SCHEMA}"."partida"`

// Mismos topes que ya aplicaba el cliente (PartidaRoom.jsx MAX_POKEMON/MAX_NPC).
// Se repiten aquí porque el límite es justo lo que evita que cualquiera
// -no solo quien controla el cliente de turno- pueda inflar el campo.
const MAX_POKEMON = 20
const MAX_NPC     = 10

/**
 * Todo lo invocado en la partida. Los Pokémon vienen ligeros -el cliente ya
 * sabe pedir el detalle completo (moves, feats) por id_master_pokemon, y
 * duplicar esa consulta aquí sería mantener la misma lógica en dos sitios-.
 * Los NPC vienen completos: su detalle por id está atado al máster
 * (`GET /master/npc/:id` no lo puede leer un jugador), así que aquí sí hace
 * falta traerlo entero para que cualquiera de la mesa pueda rehidratarlo.
 */
const listar = async (id_partida) => {
  const { rows: pokemones } = await query(
    `SELECT id_campo, id_master_pokemon, campo_hidden AS hidden, campo_in_ball AS in_ball
       FROM ${TC} WHERE id_partida = $1 AND id_master_pokemon IS NOT NULL
      ORDER BY id_campo`,
    [id_partida])
  const { rows: npcs } = await query(
    `SELECT c.id_campo, c.id_master_npc, c.campo_hidden AS hidden,
            n.master_npc_apodo, n.master_npc_level, n.master_npc_hp,
            n.master_npc_current_hp, n.master_npc_avatar
       FROM ${TC} c JOIN ${TN} n ON n.id_master_npc = c.id_master_npc
      WHERE c.id_partida = $1 AND c.id_master_npc IS NOT NULL
      ORDER BY c.id_campo`,
    [id_partida])
  return { pokemones, npcs }
}

/** ¿La partida es de este máster? Todas las escrituras lo comprueban antes de tocar nada. */
const esDuenio = async (id_partida, id_master) => {
  const { rows } = await query(`SELECT 1 FROM ${TP} WHERE id_partida = $1 AND owner_partida = $2`, [id_partida, id_master])
  return rows.length > 0
}

const agregarPokemon = async (id_partida, id_master, id_master_pokemon) => {
  if (!(await esDuenio(id_partida, id_master))) return { error: 'notfound' }
  const { rows: cnt } = await query(`SELECT COUNT(*) FROM ${TC} WHERE id_partida = $1 AND id_master_pokemon IS NOT NULL`, [id_partida])
  if (Number(cnt[0].count) >= MAX_POKEMON) return { error: 'tope' }
  // El WHERE del INSERT ya exige que el Pokémon sea de este máster: uno ajeno
  // no inserta ninguna fila (RETURNING viene vacío) en vez de reventar.
  const { rows } = await query(
    `INSERT INTO ${TC} (id_partida, id_master_pokemon)
     SELECT $1, mp.id_master_pokemon FROM ${TMP} mp WHERE mp.id_master_pokemon = $2 AND mp.id_master = $3
     ON CONFLICT (id_partida, id_master_pokemon) WHERE id_master_pokemon IS NOT NULL DO NOTHING
     RETURNING id_campo, campo_hidden AS hidden, campo_in_ball AS in_ball`,
    [id_partida, id_master_pokemon, id_master])
  if (!rows.length) return { error: 'invalido' }
  return { campo: rows[0] }
}

const agregarNpc = async (id_partida, id_master, id_master_npc) => {
  if (!(await esDuenio(id_partida, id_master))) return { error: 'notfound' }
  const { rows: cnt } = await query(`SELECT COUNT(*) FROM ${TC} WHERE id_partida = $1 AND id_master_npc IS NOT NULL`, [id_partida])
  if (Number(cnt[0].count) >= MAX_NPC) return { error: 'tope' }
  const { rows } = await query(
    `INSERT INTO ${TC} (id_partida, id_master_npc)
     SELECT $1, n.id_master_npc FROM ${TN} n WHERE n.id_master_npc = $2 AND n.id_master = $3
     ON CONFLICT (id_partida, id_master_npc) WHERE id_master_npc IS NOT NULL DO NOTHING
     RETURNING id_campo, campo_hidden AS hidden`,
    [id_partida, id_master_npc, id_master])
  if (!rows.length) return { error: 'invalido' }
  return { campo: rows[0] }
}

/** Quita una entrada del campo, sea Pokémon o NPC (el id_campo ya distingue cuál es). */
const quitar = async (id_partida, id_master, id_campo) => {
  if (!(await esDuenio(id_partida, id_master))) return { error: 'notfound' }
  const { rowCount } = await query(`DELETE FROM ${TC} WHERE id_campo = $1 AND id_partida = $2`, [id_campo, id_partida])
  return { ok: rowCount > 0 }
}

/** Cambia oculto y/o pokébola de una entrada ya invocada. */
const actualizar = async (id_partida, id_master, id_campo, { hidden, in_ball } = {}) => {
  if (!(await esDuenio(id_partida, id_master))) return { error: 'notfound' }
  const { rows } = await query(
    `UPDATE ${TC}
        SET campo_hidden  = COALESCE($3, campo_hidden),
            campo_in_ball  = COALESCE($4, campo_in_ball)
      WHERE id_campo = $1 AND id_partida = $2
      RETURNING id_campo, campo_hidden AS hidden, campo_in_ball AS in_ball`,
    [id_campo, id_partida, hidden ?? null, in_ball ?? null])
  if (!rows.length) return { error: 'notfound' }
  return { campo: rows[0] }
}

module.exports = { listar, agregarPokemon, agregarNpc, quitar, actualizar, MAX_POKEMON, MAX_NPC }
