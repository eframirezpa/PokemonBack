const { Pool } = require('pg')
require('dotenv').config()

// En serverless cada instancia levanta SU PROPIO pool, así que el total de
// conexiones es max x nº de instancias tibias, no max a secas. El pooler de
// Supabase en session mode admite 15 clientes en total: con el default de `pg`
// (max 10) bastan dos instancias para agotarlo y que cualquier endpoint empiece
// a devolver 500 (EMAXCONNSESSION), incluido el login.
//
// De ahí el pool diminuto en producción. Como contrapartida, el código no puede
// pedir dos conexiones a la vez: nada de Promise.all de queries ni de llamar a
// query() desde dentro de transaction() (ahí va el client de la transacción).
const esServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)
const poolMax = Number(process.env.DB_POOL_MAX) || (esServerless ? 2 : 10)

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: poolMax,
  // Devolver pronto las conexiones ociosas: una instancia dormida no debe
  // seguir ocupando cupo del pooler mientras otra lo necesita.
  idleTimeoutMillis: esServerless ? 10_000 : 30_000,
  // Fallar rápido y con un error claro en vez de quedarse colgado esperando.
  connectionTimeoutMillis: 10_000,
  allowExitOnIdle: esServerless,
})

const SCHEMA = process.env.DB_SCHEMA || 'juego'

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err.message)
})

/**
 * Ejecuta una query usando el pool de conexiones.
 * @param {string} text  - SQL con placeholders $1, $2...
 * @param {Array}  params
 */
async function query(text, params = []) {
  const client = await pool.connect()
  try {
    return await client.query(text, params)
  } finally {
    client.release()
  }
}

/**
 * Ejecuta un callback dentro de una transacción.
 * El callback recibe un client con .query(); se hace COMMIT al terminar
 * o ROLLBACK si lanza una excepción.
 */
async function transaction(callback) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

module.exports = { query, transaction, SCHEMA }
