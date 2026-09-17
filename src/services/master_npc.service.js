const { query, SCHEMA } = require('../config/db')

const T  = `"${SCHEMA}"."master_npc"`
const TN = `"${SCHEMA}"."nombres_npc"`

const NIVEL_MIN = 1
const NIVEL_MAX = 20
const HP_BASE   = 6
const CARAS     = 20   // face1.png … face20.png en public/avatars

const dado = (caras) => Math.floor(Math.random() * caras) + 1
const enRango = (n) => Math.max(NIVEL_MIN, Math.min(NIVEL_MAX, Math.floor(Number(n) || NIVEL_MIN)))

/**
 * Vida de un NPC recién creado.
 *
 * Base 6, y por cada nivel POR ENCIMA del primero un d6 más el nivel suelto:
 * un nivel 2 tira una vez y suma 1; un nivel 15 tira catorce veces y suma 14.
 * Se tira aquí y no en el navegador para que la vida no dependa de quién la
 * pida ni pueda amañarse desde el cliente; el máster puede editarla después.
 */
const vidaDeNivel = (nivelRaw) => {
  const nivel = enRango(nivelRaw)
  const subidas = nivel - 1
  let hp = HP_BASE + subidas          // los puntos planos, uno por subida
  for (let i = 0; i < subidas; i++) hp += dado(6)
  return hp
}

const avatarAlAzar = () => `face${dado(CARAS)}.png`

/** Un nombre y un apellido cualesquiera de la bolsa, combinados */
const apodoAlAzar = async (run = query) => {
  const { rows } = await run(
    `SELECT
       (SELECT nombre_npc_valor FROM ${TN} WHERE nombre_npc_tipo = 'nombre'   ORDER BY random() LIMIT 1) AS nombre,
       (SELECT nombre_npc_valor FROM ${TN} WHERE nombre_npc_tipo = 'apellido' ORDER BY random() LIMIT 1) AS apellido`)
  const { nombre, apellido } = rows[0] || {}
  return [nombre, apellido].filter(Boolean).join(' ') || 'NPC sin nombre'
}

/**
 * Lo que propone la ventana de creación para un nivel dado: vida tirada, apodo
 * y cara al azar. Todo editable después, menos el nivel.
 */
const sugerencia = async (nivel) => ({
  level:  enRango(nivel),
  hp:     vidaDeNivel(nivel),
  apodo:  await apodoAlAzar(),
  avatar: avatarAlAzar(),
})

const findByMaster = async (id_master) => {
  const { rows } = await query(
    `SELECT * FROM ${T} WHERE id_master = $1 ORDER BY id_master_npc DESC`, [id_master])
  return rows
}

const findById = async (id_master_npc, id_master) => {
  const { rows } = await query(
    `SELECT * FROM ${T} WHERE id_master_npc = $1 AND id_master = $2`, [id_master_npc, id_master])
  return rows[0] || null
}

const create = async (id_master, { apodo, level, hp, avatar }) => {
  const vida = Math.max(0, Math.floor(Number(hp) || 0))
  const { rows } = await query(
    `INSERT INTO ${T} (id_master, master_npc_apodo, master_npc_level, master_npc_hp, master_npc_current_hp, master_npc_avatar)
     VALUES ($1,$2,$3,$4,$4,$5) RETURNING *`,
    [id_master, String(apodo || '').trim() || 'NPC', enRango(level), vida, String(avatar || '').trim() || avatarAlAzar()])
  return rows[0]
}

/**
 * Edita al NPC. El nivel no se toca: se fija al crearlo y la vida ya se tiró
 * con él, así que cambiarlo dejaría una vida que no corresponde a nada.
 * Al subir el máximo, la vida actual sube con él; al bajarlo, se recorta.
 */
const update = async (id_master_npc, id_master, { apodo, hp, avatar }) => {
  const vida = Math.max(0, Math.floor(Number(hp) || 0))
  const { rows } = await query(
    `UPDATE ${T}
        SET master_npc_apodo = $3,
            master_npc_hp = $4,
            master_npc_current_hp = LEAST(master_npc_current_hp, $4),
            master_npc_avatar = $5,
            updated_at = now()
      WHERE id_master_npc = $1 AND id_master = $2
      RETURNING *`,
    [id_master_npc, id_master, String(apodo || '').trim() || 'NPC', vida, String(avatar || '').trim() || avatarAlAzar()])
  return rows[0] || null
}

/** La vida que le queda tras los golpes de la partida */
const setCombate = async (id_master_npc, current_hp) => {
  const { rows } = await query(
    `UPDATE ${T}
        SET master_npc_current_hp = GREATEST(0, LEAST(master_npc_hp, $2)), updated_at = now()
      WHERE id_master_npc = $1
      RETURNING *`,
    [id_master_npc, Math.max(0, Math.floor(Number(current_hp) || 0))])
  return rows[0] || null
}

const remove = async (id_master_npc, id_master) => {
  const { rowCount } = await query(
    `DELETE FROM ${T} WHERE id_master_npc = $1 AND id_master = $2`, [id_master_npc, id_master])
  return rowCount > 0
}

module.exports = {
  NIVEL_MIN, NIVEL_MAX, vidaDeNivel, avatarAlAzar, apodoAlAzar, sugerencia,
  findByMaster, findById, create, update, setCombate, remove,
}
