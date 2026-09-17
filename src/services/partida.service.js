const { query, SCHEMA } = require('../config/db')
const T = `"${SCHEMA}"."partida"`

const findActiveByUser = async (user_id) => {
  const UP = `"${SCHEMA}"."usuarios_partida"`
  const { rows } = await query(
    `SELECT p.* FROM ${T} p
     JOIN ${UP} up ON up.id_partida = p.id_partida
     WHERE up.user_id = $1 AND p.activada_partida = true
     ORDER BY p.id_partida DESC`,
    [user_id]
  )
  return rows
}

const findByOwner = async (owner_id) => {
  const { rows } = await query(
    `SELECT * FROM ${T} WHERE owner_partida = $1 ORDER BY id_partida DESC`,
    [owner_id]
  )
  return rows
}

const findById = async (id) => {
  const { rows } = await query(`SELECT * FROM ${T} WHERE id_partida = $1`, [id])
  return rows[0] || null
}

const create = async ({ nombre, descripcion, titulo1, leyenda1, titulo2, leyenda2, titulo3, leyenda3, owner_id }) => {
  const { rows } = await query(
    `INSERT INTO ${T}
       (nombre_partida, descripcion_partida,
        titulo1_partida, leyenda1_partida,
        titulo2_partida, leyenda2_partida,
        titulo3_partida, leyenda3_partida,
        activada_partida, owner_partida)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9)
     RETURNING *`,
    [nombre, descripcion, titulo1, leyenda1, titulo2, leyenda2, titulo3, leyenda3, owner_id]
  )
  return rows[0]
}

const updateSprites = async (id, { sprite1, sprite2, sprite3 }) => {
  const { rows } = await query(
    `UPDATE ${T}
     SET sprite1_partida = $1, sprite2_partida = $2, sprite3_partida = $3, updated_at = NOW()
     WHERE id_partida = $4 RETURNING *`,
    [sprite1, sprite2, sprite3, id]
  )
  return rows[0]
}

const update = async (id, { nombre, descripcion, titulo1, leyenda1, titulo2, leyenda2, titulo3, leyenda3 }) => {
  const { rows } = await query(
    `UPDATE ${T}
     SET nombre_partida=$1, descripcion_partida=$2,
         titulo1_partida=$3, leyenda1_partida=$4,
         titulo2_partida=$5, leyenda2_partida=$6,
         titulo3_partida=$7, leyenda3_partida=$8,
         updated_at=NOW()
     WHERE id_partida=$9 RETURNING *`,
    [nombre, descripcion, titulo1, leyenda1, titulo2, leyenda2, titulo3, leyenda3, id]
  )
  return rows[0] || null
}

const toggleActivada = async (id) => {
  const { rows } = await query(
    `UPDATE ${T} SET activada_partida = NOT activada_partida, updated_at = NOW()
     WHERE id_partida = $1 RETURNING *`,
    [id]
  )
  return rows[0] || null
}

const remove = async (id) => {
  const { rowCount } = await query(`DELETE FROM ${T} WHERE id_partida = $1`, [id])
  return rowCount > 0
}

// ── Pin del mapa ────────────────────────────────────────────────────────────
// Una sola marca por partida: dónde está la party. La pone el máster y la ven
// los jugadores. Las coordenadas se guardan en PORCENTAJE de la imagen, así que
// no dependen de la resolución ni del zoom de quien mire.

/**
 * El pin tal como lo consume el mapa. Postgres devuelve `numeric` como texto,
 * así que se convierte aquí: si llegara en string, el `left: x%` del pin se
 * seguiría viendo bien pero cualquier cuenta con el valor fallaría en silencio.
 */
const pinDeFila = (row) => {
  if (!row || row.mapa_pin_x == null || row.mapa_pin_y == null) return null
  return {
    x: Number(row.mapa_pin_x),
    y: Number(row.mapa_pin_y),
    label: row.mapa_pin_label || null,
    mapa: row.mapa_pin_mapa || 'all',
  }
}

const findMapaPin = async (id_partida) => {
  const { rows } = await query(
    `SELECT mapa_pin_x, mapa_pin_y, mapa_pin_label, mapa_pin_mapa
       FROM ${T} WHERE id_partida = $1`, [id_partida])
  if (!rows.length) return { error: 'notfound' }
  return { pin: pinDeFila(rows[0]) }
}

/**
 * Fija, mueve o quita el pin. `pin` en null lo borra.
 * Solo el dueño de la partida puede tocarlo: el id del máster entra en el WHERE
 * en vez de comprobarse aparte, así una partida ajena no se actualiza nunca.
 */
const setMapaPin = async (id_partida, owner_id, pin) => {
  const vacio = !pin || pin.x == null || pin.y == null
  const { rows } = await query(
    `UPDATE ${T}
        SET mapa_pin_x = $3, mapa_pin_y = $4, mapa_pin_label = $5, mapa_pin_mapa = $6,
            updated_at = now()
      WHERE id_partida = $1 AND owner_partida = $2
      RETURNING mapa_pin_x, mapa_pin_y, mapa_pin_label, mapa_pin_mapa`,
    [
      id_partida, owner_id,
      vacio ? null : Number(pin.x),
      vacio ? null : Number(pin.y),
      vacio ? null : (String(pin.label ?? '').trim() || null),
      vacio ? null : (String(pin.mapa ?? '').trim() || 'all'),
    ])
  if (!rows.length) return { error: 'notfound' }
  return { pin: pinDeFila(rows[0]) }
}

module.exports = { findActiveByUser, findByOwner, findById, create, updateSprites, update, toggleActivada, remove, findMapaPin, setMapaPin }
