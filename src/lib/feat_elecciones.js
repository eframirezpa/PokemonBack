const { SCHEMA } = require('../config/db')

const TPPM  = `"${SCHEMA}"."personaje_pokemon_moves"`
const TPPP  = `"${SCHEMA}"."personaje_pokemon_pasiva"`
const TMOVES = `"${SCHEMA}"."moves"`

// Struggle no cuenta como movimiento conocido: lo tienen todos por defecto y no
// ocupa hueco. Mismo criterio que la pantalla de subida de nivel.
const STRUGGLE_ID = 705

// Elecciones de un feat que no se quedan en personaje_pokemon_feat_bonus, sino
// que cambian otra tabla del Pokémon.
//
// El bono se guarda igual —así queda registrado qué se eligió y por qué feat—
// pero además hay que reflejarlo donde el juego lo lee de verdad: un movimiento
// aprendido vive en personaje_pokemon_moves y una pasiva en
// personaje_pokemon_pasiva.
//
// Se llama DENTRO de la transacción que inserta el feat, para que un fallo aquí
// no deje un feat a medio aplicar.

const tipo = b => String(b.type || '').toLowerCase().trim()

/**
 * Regla 3 — el movimiento elegido se aprende de verdad.
 *
 * Los PP salen del catálogo, igual que al crear el Pokémon. El +1 de Tireless
 * NO se suma aquí: ese se calcula al leer, así que el movimiento nuevo lo
 * hereda solo sin que nadie lo escriba.
 */
const aprenderMovimiento = async (client, id_personaje_pokemon, move_id, tope = null) => {
  const { rows: yaLoTiene } = await client.query(
    `SELECT 1 FROM ${TPPM}
      WHERE personaje_pokemon_moves_personaje_pokemon_id = $1
        AND personaje_pokemon_moves_move_id = $2 LIMIT 1`,
    [id_personaje_pokemon, move_id])
  if (yaLoTiene.length) return false

  // El tope no cuenta Struggle
  if (tope != null) {
    const { rows: n } = await client.query(
      `SELECT count(*)::int AS n FROM ${TPPM}
        WHERE personaje_pokemon_moves_personaje_pokemon_id = $1
          AND personaje_pokemon_moves_move_id <> $2`,
      [id_personaje_pokemon, STRUGGLE_ID])
    if (n[0].n >= tope) return false
  }

  const { rows: mv } = await client.query(
    `SELECT move_pp FROM ${TMOVES} WHERE move_id = $1`, [move_id])
  if (!mv.length) return false
  const pp = Number(mv[0].move_pp) || 0

  await client.query(
    `INSERT INTO ${TPPM}
       (personaje_pokemon_moves_personaje_pokemon_id, personaje_pokemon_moves_move_id,
        personaje_pokemon_moves_current_pp, personaje_pokemon_moves_max_pp)
     VALUES ($1, $2, $3, $3)`,
    [id_personaje_pokemon, move_id, pp])
  return true
}

/**
 * Regla 5 — la pasiva oculta sustituye a la que tenía.
 *
 * Se borran las actuales y se deja solo la oculta: el feat dice "cambia", no
 * "añade". Si tuviera más de una —que no debería— se van todas, que es lo
 * mismo que elegir una al azar para reemplazar y quedarse con una sola.
 */
const cambiarPorPasivaOculta = async (client, id_personaje_pokemon, ability_id) => {
  await client.query(
    `DELETE FROM ${TPPP} WHERE id_personaje_pokemon = $1`, [id_personaje_pokemon])
  await client.query(
    `INSERT INTO ${TPPP} (id_personaje_pokemon, id_abilitie) VALUES ($1, $2)`,
    [id_personaje_pokemon, ability_id])
  return true
}

/**
 * Aplica las elecciones que vengan en los bonos de un feat recién asignado.
 * Los tipos que no cambian otra tabla se ignoran aquí: ya quedaron guardados.
 */
const aplicarElecciones = async (client, id_personaje_pokemon, bonos = []) => {
  const hecho = { movimiento: null, pasiva: null }
  for (const b of bonos) {
    const v = Number(b.value)
    if (!Number.isFinite(v) || v <= 0) continue
    if (tipo(b) === 'learned_move')   hecho.movimiento = await aprenderMovimiento(client, id_personaje_pokemon, v) ? v : null
    if (tipo(b) === 'hidden_ability') hecho.pasiva     = await cambiarPorPasivaOculta(client, id_personaje_pokemon, v) ? v : null
  }
  return hecho
}

module.exports = { aplicarElecciones, aprenderMovimiento, cambiarPorPasivaOculta }
