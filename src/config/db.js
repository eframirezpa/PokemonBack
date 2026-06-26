const { Pool } = require('pg')
require('dotenv').config()

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
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
