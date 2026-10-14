// Captura automática de Pokémon del máster (idea #1, ver lib/captura.js).
//
// Toda la captura corre en una transacción: comprobar que el Pokémon sigue en
// el campo, descontar la pokébola, tirar contra la DC y, si lo atrapa,
// pasárselo al entrenador. Así dos entrenadores que lanzan a la vez no
// pueden atrapar el mismo Pokémon, y una pokébola nunca se gasta en un
// Pokémon que ya no estaba.
const { query, transaction, SCHEMA } = require('../config/db')
const { calcularDC, sacudidas, entero } = require('../lib/captura')
const { healingAtLevel } = require('../lib/hp')
const { transferirConCliente } = require('./master_pokemon.service')
const logSvc = require('./partida_log.service')

const TP     = `"${SCHEMA}"."partida"`
const TC     = `"${SCHEMA}"."master_campo"`
const TMP    = `"${SCHEMA}"."master_pokemon"`
const TMPF   = `"${SCHEMA}"."master_pokemon_feat"`
const TMPFB  = `"${SCHEMA}"."master_pokemon_feat_bonus"`
const TDEX   = `"${SCHEMA}"."pokemon"`
const TTYPES = `"${SCHEMA}"."pokemon_types"`
const TPERS  = `"${SCHEMA}"."personaje"`
const TPP    = `"${SCHEMA}"."personaje_pokemon"`
const TUP    = `"${SCHEMA}"."usuarios_partida"`
const TEQ    = `"${SCHEMA}"."personaje_equipo"`
const TITEM  = `"${SCHEMA}"."items"`

// ── El check del máster ──────────────────────────────────────────────────────
const findCapturaAuto = async (id_partida) => {
  const { rows } = await query(`SELECT partida_captura_auto FROM ${TP} WHERE id_partida = $1`, [id_partida])
  if (!rows.length) return { error: 'notfound' }
  return { activa: !!rows[0].partida_captura_auto }
}

const setCapturaAuto = async (id_partida, owner_id, activa) => {
  const { rows } = await query(
    `UPDATE ${TP} SET partida_captura_auto = $3, updated_at = now()
      WHERE id_partida = $1 AND owner_partida = $2
      RETURNING partida_captura_auto`, [id_partida, owner_id, !!activa])
  if (!rows.length) return { error: 'notfound' }
  return { activa: !!rows[0].partida_captura_auto }
}

// ── La captura ───────────────────────────────────────────────────────────────
const signo = (n) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`)

/**
 * body: { id_campo, id_personaje, id_personaje_equipo, d20, bono, ventaja,
 *         condicion, turnos, bono_bola }
 * d20 es el dado que quedó (con ventaja, el mayor de los dos); bono es el
 * Animal Handling de la ficha. Los dos los calcula el cliente, como la
 * iniciativa: la ficha con todos sus bonos solo se arma allí.
 */
const capturar = async (id_partida, user_id, body = {}) => {
  const d20 = entero(body.d20, 0, 20, 0)
  const bono = entero(body.bono, -10, 30)

  const r = await transaction(async (client) => {
    const { rows: part } = await client.query(
      `SELECT owner_partida, partida_captura_auto, iniciativa FROM ${TP} WHERE id_partida = $1`, [id_partida])
    if (!part.length) return { error: 'notfound' }
    if (!part[0].partida_captura_auto) return { error: 'manual' }
    const owner = part[0].owner_partida
    const ini = part[0].iniciativa

    // El personaje tiene que ser de quien lanza y estar en esta partida
    const { rows: per } = await client.query(
      `SELECT p.id_personaje, p.nombre_personaje, p.personaje_level
         FROM ${TPERS} p JOIN ${TUP} up ON up.id_usuarios_partida = p.id_usuario_partida
        WHERE p.id_personaje = $1 AND up.user_id = $2 AND up.id_partida = $3`,
      [body.id_personaje, user_id, id_partida])
    if (!per.length) return { error: 'personaje' }
    const trainer = per[0]

    // El Pokémon: bloqueado hasta terminar, para que otro lanzamiento
    // simultáneo espere y luego lo encuentre ya atrapado.
    const { rows: campo } = await client.query(
      `SELECT c.id_campo, c.campo_hidden, c.campo_in_ball, mp.id_master_pokemon, mp.id_pokemon,
              mp.pokemon_level, mp.pokemon_hp, mp.pokemon_current_hp, mp.pokemon_apodo,
              pk.pokemon_name, pk.pokemon_sr, pk.pokemon_size,
              t1.pokemon_types_name AS tipo1, t2.pokemon_types_name AS tipo2
         FROM ${TC} c
         JOIN ${TMP} mp ON mp.id_master_pokemon = c.id_master_pokemon
         JOIN ${TDEX} pk ON pk.pokemon_id = mp.id_pokemon
         LEFT JOIN ${TTYPES} t1 ON t1.pokemon_types_id = mp.personaje_pokemon_type_1
         LEFT JOIN ${TTYPES} t2 ON t2.pokemon_types_id = mp.personaje_pokemon_type_2
        WHERE c.id_campo = $1 AND c.id_partida = $2
        FOR UPDATE OF c`,
      [body.id_campo, id_partida])
    if (!campo.length) return { error: 'nocampo' }
    const poke = campo[0]
    if (poke.campo_in_ball) return { error: 'enbola' }

    // La vida que ve la mesa lleva sumado el healing de los feats (ver
    // construirEntradaPokemon en PartidaRoom.jsx): los umbrales se miden igual.
    const nivel = Number(poke.pokemon_level) || 1
    const { rows: heal } = await client.query(
      `SELECT b.master_pokemon_feat_bonus_value AS v
         FROM ${TMPFB} b JOIN ${TMPF} f ON f.master_pokemon_feat_id = b.master_pokemon_feat_bonus_master_pokemon_feat_id
        WHERE f.id_master_pokemon = $1 AND lower(b.master_pokemon_feat_bonus_type) = 'healing'`,
      [poke.id_master_pokemon])
    const healing = heal.reduce((a, h) => a + healingAtLevel(h.v, nivel), 0)
    const hpMax = (Number(poke.pokemon_hp) || 0) + healing
    const hpActual = (Number(poke.pokemon_current_hp ?? poke.pokemon_hp) || 0) + healing
    if (hpActual <= 0) return { error: 'debilitado' }

    // La pokébola: del personaje, de tipo pokeball y con al menos una
    const { rows: eq } = await client.query(
      `SELECT eq.id_personaje_equipo, eq.personaje_equipo_cantidad AS cantidad,
              i.item_name, i.item_media_sprite
         FROM ${TEQ} eq JOIN ${TITEM} i ON i.item_id = eq.id_item
        WHERE eq.id_personaje_equipo = $1 AND eq.id_personaje = $2 AND i.item_type = 'pokeball'
        FOR UPDATE OF eq`,
      [body.id_personaje_equipo, trainer.id_personaje])
    if (!eq.length || Number(eq[0].cantidad) < 1) return { error: 'sinbola' }
    const bola = eq[0]

    const { rows: previas } = await client.query(
      `SELECT 1 FROM ${TPP} WHERE id_personaje = $1 AND id_pokemon = $2 LIMIT 1`,
      [trainer.id_personaje, poke.id_pokemon])

    const calc = calcularDC({
      nivel, sr: poke.pokemon_sr, hpActual, hpMax, bola: bola.item_name,
      tipos: [poke.tipo1, poke.tipo2], tamanio: poke.pokemon_size,
      nivelEntrenador: Number(trainer.personaje_level) || 1,
      primeraRonda: Number(ini?.ronda) === 1,
      yaAtrapada: previas.length > 0,
      condicion: !!body.condicion, turnos: body.turnos, bonoBola: body.bono_bola,
    })
    if (!calc.automatica && (d20 < 1 || d20 > 20)) return { error: 'tirada' }

    // La pokébola se gasta siempre: si escapa se pierde, y si lo atrapa es su casa
    await client.query(
      `UPDATE ${TEQ} SET personaje_equipo_cantidad = personaje_equipo_cantidad - 1 WHERE id_personaje_equipo = $1`,
      [bola.id_personaje_equipo])

    const total = d20 + bono
    const exito = calc.automatica || total >= calc.dc

    let transferencia = null
    if (exito) {
      transferencia = await transferirConCliente(client, owner, poke.id_master_pokemon, trainer.id_personaje)
      if (transferencia.error) throw new Error(`No se pudo transferir el Pokémon atrapado: ${transferencia.error}`)
    }

    return {
      exito, total, d20, bono, ventaja: !!body.ventaja,
      dc: calc.dc, automatica: calc.automatica, desglose: calc.desglose,
      sacudidas: calc.automatica ? 3 : sacudidas(exito, total, calc.dc),
      uid: String(poke.id_campo),
      oculto: !!poke.campo_hidden,
      pokemon: poke.pokemon_apodo || poke.pokemon_name,
      bola: { nombre: bola.item_name, sprite: bola.item_media_sprite, restante: Number(bola.cantidad) - 1 },
      nombre_personaje: trainer.nombre_personaje || 'Sin nombre',
      en_equipo: transferencia?.en_equipo ?? null,
    }
  })
  if (r.error) return r

  // El historial se escribe aquí y no desde el cliente: así queda aunque quien
  // lanzó cierre la pestaña a mitad de la animación.
  const textos = textoCaptura(r)
  await logSvc.agregar(id_partida, { ...textos, role: 'trainer', tipo: 'captura' })
    .catch(() => { /* sin la línea del historial la captura igual vale */ })
  return { ...r, ...textos }
}

/**
 * La línea de actividad. Si el Pokémon estaba oculto y escapa, la mesa no
 * se entera de cuál era (texto); el máster sí (texto_master). Si lo atrapa,
 * se revela: ya es del entrenador.
 */
const textoCaptura = (r) => {
  const tirada = r.automatica ? '' : ` (${r.d20}${r.ventaja ? ' con ventaja' : ''} ${signo(r.bono)} = ${r.total} contra DC ${r.dc})`
  const lanzo = (nombre) => `${r.nombre_personaje} lanzó una ${r.bola.nombre} a ${nombre}${tirada}`
  if (r.exito) {
    const t = `${lanzo(r.pokemon)}: ¡lo atrapó!`
    return { texto: t, texto_master: null }
  }
  return {
    texto: `${lanzo(r.oculto ? 'un Pokémon' : r.pokemon)}: se escapó.`,
    texto_master: r.oculto ? `${lanzo(r.pokemon)}: se escapó.` : null,
  }
}

module.exports = { findCapturaAuto, setCapturaAuto, capturar, textoCaptura }
