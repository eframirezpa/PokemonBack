// Historial de actividad de la mesa (partida_log): quién hizo qué, para que
// sobreviva a un refresco o una reconexión. Antes solo vivía en memoria de
// cada navegador, repartido por broadcast de Supabase.
const { query, SCHEMA } = require('../config/db')

const T = `"${SCHEMA}"."partida_log"`

// Tope de líneas que trae el historial al conectarse: de sobra para una
// sesión de mesa, y evita que una partida vieja y larga tarde en cargar.
const LIMIT = 300
const MAX_TEXTO = 500

/**
 * Los ataques de un Pokémon oculto llevan dos versiones (ver migración
 * 0004). Cuál se devuelve se decide aquí, según el rol de quien consulta.
 */
const listar = async (id_partida, esMaster) => {
  const { rows } = await query(
    `SELECT id_partida_log AS id,
            CASE WHEN $2 AND partida_log_texto_master IS NOT NULL
                 THEN partida_log_texto_master ELSE partida_log_texto END AS texto,
            partida_log_role AS role, partida_log_created_at AS time
       FROM ${T}
      WHERE id_partida = $1
      ORDER BY id_partida_log DESC
      LIMIT ${LIMIT}`,
    [id_partida, !!esMaster])
  return rows.reverse()
}

/**
 * Agrega una línea. La escribe quien origina la acción (el cliente que llamó
 * a sendActivity/sendAttack), una sola vez -no cada cliente que la recibe por
 * broadcast-, para no duplicar filas por cada persona conectada.
 */
const agregar = async (id_partida, { texto, texto_master, role }) => {
  const limpio = String(texto ?? '').trim()
  if (!limpio) return { error: 'texto' }
  const real = String(texto_master ?? '').trim()
  const { rows } = await query(
    `INSERT INTO ${T} (id_partida, partida_log_texto, partida_log_texto_master, partida_log_role)
     VALUES ($1, $2, $3, $4)
     RETURNING id_partida_log AS id, partida_log_created_at AS time`,
    [id_partida, limpio.slice(0, MAX_TEXTO), real ? real.slice(0, MAX_TEXTO) : null, String(role || 'master').slice(0, 20)])
  return rows[0]
}

module.exports = { listar, agregar }
