const { query, SCHEMA } = require('../config/db')
const T = `"${SCHEMA}"."items"`

const findAll = async ({ limit = 20, offset = 0, search = '', type = '', excludeType = '' }) => {
  const params = []
  const conditions = []

  if (search) {
    params.push(`%${search}%`)
    conditions.push(`item_name ILIKE $${params.length}`)
  }
  if (type) {
    // "held item,berry" → cualquiera de los dos. Sigue aceptando un solo
    // valor tal cual, así que no rompe a nadie que ya llame con uno solo.
    const tipos = type.split(',').map(t => t.trim()).filter(Boolean)
    params.push(tipos)
    conditions.push(`item_type = ANY($${params.length})`)
  }
  if (excludeType) {
    params.push(excludeType)
    conditions.push(`item_type <> $${params.length}`)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  params.push(limit, offset)

  const { rows } = await query(
    `SELECT item_id, item_name, item_type, item_cost, item_description, item_media_sprite
     FROM ${T} ${where}
     ORDER BY item_name
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )
  const { rows: c } = await query(
    `SELECT COUNT(*) FROM ${T} ${where}`, params.slice(0, -2)
  )
  return { data: rows, total: Number(c[0].count) }
}

const findById = async (id) => {
  const { rows } = await query(`SELECT * FROM ${T} WHERE item_id = $1`, [id])
  return rows[0] || null
}

/**
 * Crea un item nuevo (lo usa el máster desde la mochila de la partida).
 *
 * item_id lo genera la identity column: la migración 0001 dejó su sequence en
 * MAX(item_id)+1 (antes se había quedado en 9 contra un máximo real de 463,
 * de cuando la tabla se cargó con ids explícitos), así que ya no hace falta
 * calcularlo a mano en el INSERT.
 */
const create = async ({ item_name, item_type, item_cost, item_description }) => {
  const item_name_id = item_name.trim().toLowerCase().replace(/\s+/g, '-')
  const { rows } = await query(
    `INSERT INTO ${T} (
       item_name_id, item_name, item_type, item_cost,
       item_description, item_media_sprite, item_notes, item_last_updated
     )
     VALUES ($1, $2, $3, $4, $5, NULL, NULL, now()::text)
     RETURNING *`,
    [item_name_id, item_name, item_type, item_cost, item_description]
  )
  return rows[0]
}

/**
 * Edita un item del catálogo: nombre, precio, tipo y descripción.
 *
 * En la mochila y en los Pokémon el item se referencia por item_id (entero),
 * nunca por el nombre, así que renombrarlo aquí no rompe nada ya repartido.
 * item_name_id (el slug) se regenera junto con el nombre para que no quede
 * desincronizado.
 */
const update = async (item_id, { item_name, item_type, item_cost, item_description }) => {
  // item_last_updated no se toca: la tabla tiene un trigger que la pisa con
  // now() en cada UPDATE, así que ponerla aquí solo confundiría al leerlo.
  const item_name_id = item_name.trim().toLowerCase().replace(/\s+/g, '-')
  const { rows } = await query(
    `UPDATE ${T}
        SET item_name = $2, item_name_id = $3, item_type = $4, item_cost = $5, item_description = $6
      WHERE item_id = $1
      RETURNING *`,
    [item_id, item_name.trim(), item_name_id, item_type, item_cost, item_description])
  return rows[0] || null
}

/**
 * Cuántas veces está repartido este item por la partida: mochilas, held
 * items de Pokémon, herramienta de un background y held item de una plantilla
 * del máster. Antes de borrar hay que saberlo: dos de esas relaciones son
 * CASCADE (borrarían el item de mochilas y Pokémon en silencio) y las otras
 * dos son NO ACTION (el borrado fallaría con un error de FK poco claro).
 */
const usoDelItem = async (item_id) => {
  const { rows } = await query(
    `SELECT
       (SELECT COUNT(*) FROM "${SCHEMA}"."personaje_equipo" WHERE id_item = $1) AS mochilas,
       (SELECT COUNT(*) FROM "${SCHEMA}"."personaje_pokemon_held_item" WHERE personaje_pokemon_held_item_id_item = $1) AS equipados,
       (SELECT COUNT(*) FROM "${SCHEMA}"."backgrounds" WHERE background_tool_item_id = $1) AS backgrounds,
       (SELECT COUNT(*) FROM "${SCHEMA}"."master_pokemon" WHERE personaje_pokemon_held_item = $1) AS plantillas`,
    [item_id])
  const r = rows[0]
  return {
    mochilas: Number(r.mochilas), equipados: Number(r.equipados),
    backgrounds: Number(r.backgrounds), plantillas: Number(r.plantillas),
  }
}

/**
 * Borra un item del catálogo, pero solo si no está en uso: en mochilas, en
 * Pokémon (held item), en un background que lo pida como herramienta, o en
 * una plantilla de Pokémon del máster. Repartirlo y luego borrarlo del
 * catálogo dejaría esas referencias apuntando a nada (o las cuatro CASCADE se
 * lo llevarían puesto de encima, silenciosamente).
 */
const remove = async (item_id) => {
  const uso = await usoDelItem(item_id)
  const total = uso.mochilas + uso.equipados + uso.backgrounds + uso.plantillas
  if (total > 0) {
    const partes = []
    if (uso.mochilas)     partes.push(`${uso.mochilas} en mochila${uso.mochilas > 1 ? 's' : ''}`)
    if (uso.equipados)    partes.push(`${uso.equipados} equipado${uso.equipados > 1 ? 's' : ''}`)
    if (uso.backgrounds)  partes.push(`${uso.backgrounds} en background${uso.backgrounds > 1 ? 's' : ''}`)
    if (uso.plantillas)   partes.push(`${uso.plantillas} en plantilla${uso.plantillas > 1 ? 's' : ''} del máster`)
    const e = new Error(`No se puede borrar: está en uso (${partes.join(', ')})`)
    e.enUso = true
    throw e
  }
  const { rows } = await query(`DELETE FROM ${T} WHERE item_id = $1 RETURNING item_id`, [item_id])
  return rows.length > 0
}

module.exports = { findAll, findById, create, update, remove }
