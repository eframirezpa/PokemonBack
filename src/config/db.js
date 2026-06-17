// Capa de conexión a PostgreSQL.
// Para migrar a Supabase: reemplaza este Pool por el cliente @supabase/supabase-js
// y actualiza el método query() en consecuencia.
const { Pool } = require('pg')
require('dotenv').config()

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
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

module.exports = { query, SCHEMA }
