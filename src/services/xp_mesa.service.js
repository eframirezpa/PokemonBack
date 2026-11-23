// Experiencia en mesa (plan-xp-y-mesa, etapa 4). Ver migrations/0010_partida_xp.sql.
//
// Flujo:
//  1. Cada ataque con un Pokémon del máster como objetivo, y cada Poké Ball
//     lanzada a él, deja una intervención (registrarIntervencion).
//  2. Al derrotarlo o atraparlo, el máster crea la experiencia pendiente
//     (crearXp); el servidor calcula la cifra, no el cliente.
//  3. El máster la ve con los entrenadores que intervinieron (pendientesDm) y
//     la confirma repartida entre ellos (confirmar) o la cierra a mano (manual).
//  4. Cada entrenador ve su parte (pendientesEntrenador) y la reparte entre
//     sus Pokémon (eso va en la parte D).
const { query, transaction, SCHEMA } = require('../config/db')
const { xpPorMotivo, agruparIntervenciones, validarRepartoDm } = require('../lib/xp')

const TI   = `"${SCHEMA}"."partida_intervencion"`
const TX   = `"${SCHEMA}"."partida_xp"`
const TR   = `"${SCHEMA}"."partida_xp_reparto"`
const TP   = `"${SCHEMA}"."partida"`
const TPJ  = `"${SCHEMA}"."personaje"`
const TUP  = `"${SCHEMA}"."usuarios_partida"`
const TPP  = `"${SCHEMA}"."personaje_pokemon"`

const esDuenio = async (id_partida, id_master) => {
  const { rows } = await query(`SELECT 1 FROM ${TP} WHERE id_partida = $1 AND owner_partida = $2`, [id_partida, id_master])
  return rows.length > 0
}

/** ¿Este personaje es de este usuario y está en esta partida? */
const personajeDelUsuario = async (id_partida, id_personaje, user_id) => {
  const { rows } = await query(
    `SELECT 1 FROM ${TPJ} p JOIN ${TUP} up ON up.id_usuarios_partida = p.id_usuario_partida
      WHERE p.id_personaje = $1 AND up.id_partida = $2 AND up.user_id = $3`,
    [id_personaje, id_partida, user_id])
  return rows.length > 0
}

/** 1. Un ataque o una Poké Ball contra un Pokémon del máster en el campo. */
const registrarIntervencion = async (id_partida, user_id, { id_campo, id_personaje, id_personaje_pokemon = null, tipo }) => {
  if (!['ataque', 'pokebola'].includes(tipo)) return { error: 'tipo' }
  if (!Number.isInteger(id_campo) || !Number.isInteger(id_personaje)) return { error: 'datos' }
  if (!(await personajeDelUsuario(id_partida, id_personaje, user_id))) return { error: 'ajeno' }
  if (id_personaje_pokemon != null) {
    const { rows } = await query(`SELECT 1 FROM ${TPP} WHERE id_personaje_pokemon = $1 AND id_personaje = $2`,
      [id_personaje_pokemon, id_personaje])
    if (!rows.length) return { error: 'ajeno' }
  }
  await insertarIntervencion({ query }, { id_partida, id_campo, id_personaje, id_personaje_pokemon, tipo })
  return { ok: true }
}

/** Inserta una intervención con el cliente dado (puede ser el de una transacción). */
const insertarIntervencion = (db, { id_partida, id_campo, id_personaje, id_personaje_pokemon = null, tipo }) =>
  db.query(
    `INSERT INTO ${TI} (id_partida, id_campo, id_personaje, id_personaje_pokemon, intervencion_tipo)
     VALUES ($1, $2, $3, $4, $5)`,
    [id_partida, id_campo, id_personaje, id_personaje_pokemon, tipo])

/**
 * Crea la experiencia pendiente con el cliente dado. Una sola por Pokémon del
 * campo: si ya existe (dos clics, derrotado y luego atrapado) devuelve esa.
 */
const insertarXp = async (db, { id_partida, id_campo, pokemon, nivel, sr, motivo }) => {
  const xp = xpPorMotivo(motivo, nivel, sr)
  if (xp == null) return { error: 'sinxp' }   // SR "Varies": a criterio del DM, a mano
  const { rows: ya } = await db.query(
    `SELECT id_xp FROM ${TX} WHERE id_partida = $1 AND id_campo = $2`, [id_partida, id_campo])
  if (ya.length) return { ok: true, id_xp: ya[0].id_xp, repetida: true }
  const { rows } = await db.query(
    `INSERT INTO ${TX} (id_partida, id_campo, xp_pokemon, xp_nivel, xp_sr, xp_motivo, xp_total)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id_xp`,
    [id_partida, id_campo, String(pokemon || 'Pokémon').slice(0, 80), Number(nivel), sr == null ? null : String(sr), motivo, xp])
  return { ok: true, id_xp: rows[0].id_xp }
}

/** 2. El máster anota la experiencia de un Pokémon derrotado o atrapado. */
const crearXp = async (id_partida, id_master, { id_campo, pokemon, nivel, sr, motivo }) => {
  if (!(await esDuenio(id_partida, id_master))) return { error: 'notfound' }
  if (!['derrota', 'captura'].includes(motivo)) return { error: 'motivo' }
  if (!Number.isInteger(id_campo)) return { error: 'datos' }
  return insertarXp({ query }, { id_partida, id_campo, pokemon, nivel, sr, motivo })
}

/**
 * 3. Lo pendiente del máster, cada uno con los entrenadores que intervinieron.
 * Incluye a todos los entrenadores de la partida (para "Agregar otro").
 */
const pendientesDm = async (id_partida, id_master) => {
  if (!(await esDuenio(id_partida, id_master))) return { error: 'notfound' }
  const { rows: xps } = await query(
    `SELECT id_xp, id_campo, xp_pokemon, xp_nivel, xp_sr, xp_motivo, xp_total, created_at
       FROM ${TX} WHERE id_partida = $1 AND xp_estado = 'pendiente' ORDER BY id_xp`, [id_partida])
  const { rows: entrenadores } = await query(
    `SELECT p.id_personaje, p.nombre_personaje
       FROM ${TPJ} p JOIN ${TUP} up ON up.id_usuarios_partida = p.id_usuario_partida
      WHERE up.id_partida = $1 ORDER BY p.id_personaje`, [id_partida])
  if (!xps.length) return { pendientes: [], entrenadores }
  const { rows: inter } = await query(
    `SELECT id_campo, id_personaje, id_personaje_pokemon, intervencion_tipo
       FROM ${TI} WHERE id_partida = $1 AND id_campo = ANY($2::int[]) ORDER BY id_intervencion`,
    [id_partida, xps.map(x => x.id_campo)])
  const pendientes = xps.map(x => ({
    ...x,
    intervinieron: agruparIntervenciones(inter.filter(i => i.id_campo === x.id_campo)),
  }))
  return { pendientes, entrenadores }
}

/** 3b. El máster confirma el reparto entre entrenadores. */
const confirmar = async (id_partida, id_master, id_xp, reparto) => {
  if (!(await esDuenio(id_partida, id_master))) return { error: 'notfound' }
  return transaction(async (client) => {
    const { rows } = await client.query(
      `SELECT xp_total, xp_estado, id_campo FROM ${TX} WHERE id_xp = $1 AND id_partida = $2 FOR UPDATE`,
      [id_xp, id_partida])
    const x = rows[0]
    if (!x) return { error: 'notfound' }
    if (x.xp_estado !== 'pendiente') return { error: 'resuelta' }
    const v = validarRepartoDm(reparto, x.xp_total)
    if (v.error) return { error: v.error }
    // Solo entrenadores de esta partida
    const { rows: deLaPartida } = await client.query(
      `SELECT p.id_personaje FROM ${TPJ} p JOIN ${TUP} up ON up.id_usuarios_partida = p.id_usuario_partida
        WHERE up.id_partida = $1 AND p.id_personaje = ANY($2::int[])`,
      [id_partida, v.reparto.map(r => r.id_personaje)])
    if (deLaPartida.length !== v.reparto.length) return { error: 'personaje' }
    for (const r of v.reparto) {
      if (r.xp <= 0) continue   // marcado con 0: no recibe nada, no se le pregunta
      await client.query(
        `INSERT INTO ${TR} (id_xp, id_personaje, reparto_xp) VALUES ($1, $2, $3)`,
        [id_xp, r.id_personaje, r.xp])
    }
    await client.query(
      `UPDATE ${TX} SET xp_estado = 'confirmada', resuelta_at = now() WHERE id_xp = $1`, [id_xp])
    await client.query(`DELETE FROM ${TI} WHERE id_partida = $1 AND id_campo = $2`, [id_partida, x.id_campo])
    return { ok: true, entrenadores: v.reparto.filter(r => r.xp > 0).map(r => r.id_personaje) }
  })
}

/** 3c. "Manual: cerrar e ignorar": no se otorga nada por la app. */
const manual = async (id_partida, id_master, id_xp) => {
  if (!(await esDuenio(id_partida, id_master))) return { error: 'notfound' }
  const { rows } = await query(
    `UPDATE ${TX} SET xp_estado = 'manual', resuelta_at = now()
      WHERE id_xp = $1 AND id_partida = $2 AND xp_estado = 'pendiente' RETURNING id_campo`,
    [id_xp, id_partida])
  if (!rows.length) return { error: 'notfound' }
  await query(`DELETE FROM ${TI} WHERE id_partida = $1 AND id_campo = $2`, [id_partida, rows[0].id_campo])
  return { ok: true }
}

/** 4. Las partes del entrenador que aún no ha repartido entre sus Pokémon. */
const pendientesEntrenador = async (id_partida, id_personaje, user_id) => {
  if (!(await personajeDelUsuario(id_partida, id_personaje, user_id))) return { error: 'ajeno' }
  const { rows } = await query(
    `SELECT r.id_reparto, r.reparto_xp, x.xp_pokemon, x.xp_nivel, x.xp_motivo
       FROM ${TR} r JOIN ${TX} x ON x.id_xp = r.id_xp
      WHERE r.id_personaje = $1 AND r.asignada_at IS NULL AND x.id_partida = $2
      ORDER BY r.id_reparto`,
    [id_personaje, id_partida])
  return { pendientes: rows }
}

module.exports = {
  registrarIntervencion, crearXp, pendientesDm, confirmar, manual, pendientesEntrenador,
  insertarIntervencion, insertarXp,
}
