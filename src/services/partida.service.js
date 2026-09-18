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

// ── Iniciativa ──────────────────────────────────────────────────────────────
// El orden de turno de la partida, guardado entero en una columna JSON: se
// reemplaza completo en cada cambio y nunca se consulta por dentro. Lo que se
// guarda es lo que hace que sobreviva a una recarga; el canal de la partida se
// encarga de que además se vea al instante.

const num = (v, porDefecto = 0) => (Number.isFinite(Number(v)) ? Number(v) : porDefecto)

/** Deja la tirada en forma: total = d20 + modificador, y ordena de mayor a menor */
const ordenarParticipantes = (participantes = []) => participantes
  .map(p => ({
    clave:       String(p.clave),
    user_id:     p.user_id ?? null,
    personaje_id: p.personaje_id ?? null,
    nombre:      String(p.nombre || 'Sin nombre'),
    es_master:   !!p.es_master,
    mod:         num(p.mod),
    d20:         p.d20 == null ? null : num(p.d20),
    listo:       p.d20 != null,
    total:       p.d20 == null ? null : num(p.d20) + num(p.mod),
  }))
  // Los que ya tiraron primero y de mayor a menor. Empate: el modificador más
  // alto manda, que es el desempate habitual en mesa.
  .sort((a, b) => (b.listo - a.listo) || (b.total - a.total) || (b.mod - a.mod))

const findIniciativa = async (id_partida) => {
  const { rows } = await query(`SELECT iniciativa FROM ${T} WHERE id_partida = $1`, [id_partida])
  if (!rows.length) return { error: 'notfound' }
  return { iniciativa: rows[0].iniciativa || null }
}

/**
 * Reemplaza el estado entero. Con `owner_id` la propiedad entra en el WHERE, que
 * es como se comprueba en el resto de la partida: una ajena no se toca nunca.
 * Sin él escribe directo, para los cambios que ya vienen validados de dentro.
 */
const guardarIniciativa = async (id_partida, iniciativa, owner_id = null) => {
  const { rows } = await query(
    `UPDATE ${T} SET iniciativa = $2, updated_at = now()
      WHERE id_partida = $1 ${owner_id != null ? 'AND owner_partida = $3' : ''}
      RETURNING iniciativa`,
    owner_id != null ? [id_partida, iniciativa ? JSON.stringify(iniciativa) : null, owner_id]
                     : [id_partida, iniciativa ? JSON.stringify(iniciativa) : null])
  if (!rows.length) return { error: 'notfound' }
  return { iniciativa: rows[0].iniciativa || null }
}

/**
 * Nombre con el que sale alguien en la ronda, decidido aquí y no por el cliente.
 *
 * El personaje solo cuenta si de verdad es de ese usuario y está en esta
 * partida. Sin esa comprobación el nombre salía de la presencia, que puede
 * traer un personaje ajeno: con dos cuentas en el mismo navegador, la segunda
 * heredaba el de la primera y la ronda mostraba el mismo nombre dos veces.
 * Si el personaje no cuadra, se usa el nombre de usuario, que nunca miente.
 */
const TUP = `"${SCHEMA}"."usuarios_partida"`
const resolverNombre = async (id_partida, user_id, personaje_id) => {
  if (personaje_id != null) {
    const { rows } = await query(
      `SELECT p.id_personaje, p.nombre_personaje
         FROM "${SCHEMA}"."personaje" p
         JOIN ${TUP} up ON up.id_usuarios_partida = p.id_usuario_partida
        WHERE p.id_personaje = $1 AND up.user_id = $2 AND up.id_partida = $3`,
      [personaje_id, user_id, id_partida])
    if (rows.length) return { personaje_id: rows[0].id_personaje, nombre: rows[0].nombre_personaje || 'Sin nombre' }
  }
  const { rows } = await query(`SELECT user_name FROM "${SCHEMA}"."usuarios" WHERE user_id = $1`, [user_id])
  return { personaje_id: null, nombre: rows[0]?.user_name || 'Sin nombre' }
}

/** Abre la ronda: todos sin tirada, esperando a que cada quien meta su d20 */
const abrirIniciativa = async (id_partida, owner_id, participantes) => {
  const resueltos = []
  for (const p of (participantes || [])) {
    if (p.user_id == null) continue
    // El máster no tiene personaje: sale con su nombre de usuario
    const quien = p.es_master
      ? await resolverNombre(id_partida, p.user_id, null)
      : await resolverNombre(id_partida, p.user_id, p.personaje_id)
    resueltos.push({ ...p, ...quien, clave: `u${p.user_id}`, d20: null })
  }
  return guardarIniciativa(id_partida, {
    estado: 'pidiendo',
    ronda: 1,
    turno: 0,
    participantes: ordenarParticipantes(resueltos),
  }, owner_id)
}

/**
 * Apunta la tirada de UN participante. La puede llamar cualquiera de la mesa,
 * pero solo sobre su propia entrada: la clave se compara con quien pide.
 */
const tirarIniciativa = async (id_partida, clave, d20, mod, user_id = null, personaje_id = null) => {
  const actual = await findIniciativa(id_partida)
  if (actual.error) return actual
  const ini = actual.iniciativa
  if (!ini || !Array.isArray(ini.participantes)) return { error: 'sinronda' }
  if (!ini.participantes.some(p => p.clave === clave)) return { error: 'noparticipa' }

  // Quien tira sabe con qué personaje juega; el máster solo lo había adivinado
  // por la presencia. Se corrige aquí, y verificado: nunca un personaje ajeno.
  const propio = ini.participantes.find(p => p.clave === clave)
  const quien = (!propio.es_master && user_id != null && personaje_id != null)
    ? await resolverNombre(id_partida, user_id, personaje_id)
    : null

  const participantes = ini.participantes.map(p => p.clave === clave
    ? { ...p, ...(quien || {}), d20: num(d20), mod: mod == null ? p.mod : num(mod) }
    : p)

  return guardarIniciativa(id_partida, { ...ini, participantes: ordenarParticipantes(participantes) })
}

/**
 * Pasa el turno. Lo puede hacer el máster siempre, y el dueño del turno solo
 * hacia adelante: es su forma de decir "ya terminé". La comprobación vive aquí
 * y no en el cliente porque si no, cualquiera podría saltarse el orden.
 *
 * Al dar la vuelta completa entra una ronda nueva.
 */
const avanzarTurno = async (id_partida, user_id, esMaster, direccion = 'siguiente') => {
  const actual = await findIniciativa(id_partida)
  if (actual.error) return actual
  const ini = actual.iniciativa
  if (!ini || ini.estado !== 'activa' || !ini.participantes?.length) return { error: 'sinronda' }

  const turno = num(ini.turno)
  if (!esMaster && ini.participantes[turno]?.user_id !== user_id) return { error: 'noesturno' }
  if (!esMaster && direccion !== 'siguiente') return { error: 'noesturno' }

  const total = ini.participantes.length
  const paso = direccion === 'anterior' ? -1 : 1
  const siguiente = (turno + paso + total) % total
  // Solo suma ronda al pasar del último al primero, no al retroceder
  const ronda = num(ini.ronda, 1) + (paso === 1 && siguiente === 0 ? 1 : 0)

  return guardarIniciativa(id_partida, { ...ini, turno: siguiente, ronda })
}

module.exports = { avanzarTurno, findActiveByUser, findByOwner, findById, create, updateSprites, update, toggleActivada, remove, findMapaPin, setMapaPin, findIniciativa, guardarIniciativa, abrirIniciativa, tirarIniciativa }
