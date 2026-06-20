const bcrypt = require('bcrypt')
const { query, SCHEMA } = require('../config/db')
const T  = `"${SCHEMA}"."usuarios"`
const TR = `"${SCHEMA}"."roles"`
const SALT_ROUNDS = 10

const findAll = async () => {
  const { rows } = await query(
    `SELECT u.user_id, u.user_name, u.role_id, r.role_name, u.created_at, u.updated_at
     FROM ${T} u
     JOIN ${TR} r ON r.role_id = u.role_id
     ORDER BY u.user_id`
  )
  return rows
}

const findById = async (id) => {
  const { rows } = await query(
    `SELECT u.user_id, u.user_name, u.role_id, r.role_name, u.created_at, u.updated_at
     FROM ${T} u
     JOIN ${TR} r ON r.role_id = u.role_id
     WHERE u.user_id = $1`,
    [id]
  )
  return rows[0] || null
}

const findByUsername = async (user_name) => {
  const { rows } = await query(
    `SELECT u.*, r.role_name
     FROM ${T} u
     JOIN ${TR} r ON r.role_id = u.role_id
     WHERE u.user_name = $1`,
    [user_name]
  )
  return rows[0] || null
}

const create = async ({ user_name, user_password, role_id }) => {
  const hashed = await bcrypt.hash(user_password, SALT_ROUNDS)
  const { rows } = await query(
    `INSERT INTO ${T} (user_name, user_password, role_id)
     VALUES ($1, $2, $3)
     RETURNING user_id, user_name, role_id, created_at`,
    [user_name, hashed, role_id]
  )
  return rows[0]
}

const update = async (id, { user_name, user_password, role_id }) => {
  const fields = []
  const params = []

  if (user_name) {
    params.push(user_name)
    fields.push(`user_name = $${params.length}`)
  }
  if (user_password) {
    const hashed = await bcrypt.hash(user_password, SALT_ROUNDS)
    params.push(hashed)
    fields.push(`user_password = $${params.length}`)
  }
  if (role_id) {
    params.push(role_id)
    fields.push(`role_id = $${params.length}`)
  }

  if (!fields.length) return findById(id)

  params.push(id)
  fields.push(`updated_at = NOW()`)

  const { rows } = await query(
    `UPDATE ${T} SET ${fields.join(', ')} WHERE user_id = $${params.length}
     RETURNING user_id, user_name, role_id, updated_at`,
    params
  )
  return rows[0] || null
}

const remove = async (id) => {
  const { rowCount } = await query(`DELETE FROM ${T} WHERE user_id = $1`, [id])
  return rowCount > 0
}

module.exports = { findAll, findById, findByUsername, create, update, remove }
