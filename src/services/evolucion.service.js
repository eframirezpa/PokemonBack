// Evolución de los Pokémon del entrenador (reglas de poke5e, sección
// "Evolution"). Los datos de cada evolución -condiciones y puntos de stat-
// salen de la tabla `evolution`.
//
// Lo que el Pokémon copió de su especie al crearse (dado de golpe, AC, tipos,
// velocidades, sentidos, saving throws) no se actualiza solo al cambiar
// id_pokemon, así que aquí se reescribe con lo de la especie nueva. Lo que se
// lee en vivo de la pokédex (nombre, imágenes, el dado de las subidas de
// nivel) cambia solo.
const { query, transaction, SCHEMA } = require('../config/db')
const { evaluarCondiciones, validarPuntos, topeStat, STAT_KEYS } = require('../lib/evolucion')
const { claveMove, SQL_CLAVE_MOVE } = require('../lib/move_name')
const { movePoolNames, STRUGGLE_ID } = require('./personaje_pokemon_improvement.service')
const { efectosDePokemon } = require('../lib/pokemon_feats')

const TPP   = `"${SCHEMA}"."personaje_pokemon"`
const TPK   = `"${SCHEMA}"."pokemon"`
const TEVO  = `"${SCHEMA}"."evolution"`
const TPS   = `"${SCHEMA}"."pokemon_stats"`
const TPSK  = `"${SCHEMA}"."pokemon_skills"`
const TSK   = `"${SCHEMA}"."skills"`
const TPPM  = `"${SCHEMA}"."personaje_pokemon_moves"`
const TMOV  = `"${SCHEMA}"."moves"`
const TPPA  = `"${SCHEMA}"."personaje_pokemon_pasiva"`
const TABI  = `"${SCHEMA}"."abilities"`
const TEQ   = `"${SCHEMA}"."personaje_equipo"`
const TIT   = `"${SCHEMA}"."items"`
const TBOND = `"${SCHEMA}"."bonds"`
const TTYP  = `"${SCHEMA}"."pokemon_types"`

const norm = s => String(s || '').toLowerCase().trim()
const splitList = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean)

// Habilidades de una especie: [{ id, hidden }]
const habilidadesDe = (pk) => [1, 2, 3, 4]
  .map(n => ({ id: pk[`pokemon_ability_${n}`], hidden: Number(pk[`pokemon_ability_${n}_is_hidden`]) === 1 }))
  .filter(a => a.id != null)
  .map(a => ({ id: Number(a.id), hidden: a.hidden }))

// Une dos listas de texto ("Dex, Wis") sin repetir, conservando la grafía.
const unirLista = (a, b) => {
  const vistos = new Set(), out = []
  for (const x of [...splitList(a), ...splitList(b)]) {
    if (vistos.has(norm(x))) continue
    vistos.add(norm(x)); out.push(x)
  }
  return out.join(', ')
}

/** Todo lo que hace falta para decidir y mostrar las evoluciones posibles. */
const contexto = async (id_personaje, id_personaje_pokemon, run = query) => {
  const { rows: ppRows } = await run(
    `SELECT pp.*, pk.pokemon_name AS especie,
            ${[1, 2, 3, 4].map(n => `pk.pokemon_ability_${n} AS old_ab_${n}, pk.pokemon_ability_${n}_is_hidden AS old_ab_${n}_hidden`).join(', ')},
            b.bond_level
       FROM ${TPP} pp
       JOIN ${TPK} pk ON pk.pokemon_id = pp.id_pokemon
       LEFT JOIN ${TBOND} b ON b.bond_id = pp.personaje_pokemon_bond
      WHERE pp.id_personaje_pokemon = $1 AND pp.id_personaje = $2`,
    [id_personaje_pokemon, id_personaje])
  const pp = ppRows[0]
  if (!pp) return null

  // En serie: dentro de la transacción todas van por el mismo client
  const moves = await run(`SELECT m.move_id, m.move_name, m.move_type, m.move_pp, m.move_time, m.move_range
           FROM ${TPPM} pm JOIN ${TMOV} m ON m.move_id = pm.personaje_pokemon_moves_move_id
          WHERE pm.personaje_pokemon_moves_personaje_pokemon_id = $1
          ORDER BY pm.personaje_pokemon_moves_id`, [id_personaje_pokemon]).then(r => r.rows)
  const mochila = await run(`SELECT i.item_name FROM ${TEQ} eq JOIN ${TIT} i ON i.item_id = eq.id_item
          WHERE eq.id_personaje = $1 AND eq.personaje_equipo_cantidad > 0`, [id_personaje]).then(r => r.rows)
  const catalogo = await run(`SELECT item_name FROM ${TIT}`).then(r => r.rows)
  const stats = await run(`SELECT * FROM ${TPS} WHERE id_personaje_pokemon = $1`, [id_personaje_pokemon]).then(r => r.rows[0] || {})
  const pasiva = await run(`SELECT pa.id_abilitie, a.ability_name FROM ${TPPA} pa LEFT JOIN ${TABI} a ON a.ability_id = pa.id_abilitie
          WHERE pa.id_personaje_pokemon = $1 ORDER BY pa.id_personaje_pokemon_pasiva_id LIMIT 1`, [id_personaje_pokemon]).then(r => r.rows[0] || null)
  const evos = await run(`SELECT e.*, pk.* FROM ${TEVO} e JOIN ${TPK} pk ON pk.pokemon_id = e.evolution_to_pokemon_id
          WHERE e.evolution_from_pokemon_id = $1 ORDER BY e.evolution_id`, [pp.id_pokemon]).then(r => r.rows)

  const ctx = {
    nivel: Number(pp.pokemon_level) || 1,
    genero: pp.personaje_pokemon_genero,
    bondLevel: pp.bond_level != null ? Number(pp.bond_level) : null,
    moveClaves: new Set(moves.map(m => claveMove(m.move_name))),
    moveTipos: new Set(moves.map(m => norm(m.move_type)).filter(Boolean)),
    itemClaves: new Set(mochila.map(i => claveMove(i.item_name))),
    itemsCatalogoClaves: new Set(catalogo.map(i => claveMove(i.item_name))),
  }

  // Movimientos: puede quedarse con los que sabe o tomar los de la forma
  // nueva hasta su nivel. Una sola consulta para el pool de todas las ramas.
  const maxMoves = (await efectosDePokemon(run, id_personaje_pokemon)).known_moves_max
  const poolPorEvo = new Map(evos.map(e => [Number(e.evolution_id), movePoolNames(e, ctx.nivel)]))
  const todasClaves = [...new Set([...poolPorEvo.values()].flat())]
  const { rows: poolRows } = todasClaves.length
    ? await run(`SELECT move_id, move_name, move_type, move_pp, move_time, move_range FROM ${TMOV}
                  WHERE ${SQL_CLAVE_MOVE('move_name')} = ANY($1) AND move_id <> $2`, [todasClaves, STRUGGLE_ID])
    : { rows: [] }
  const sabidos = moves.filter(m => Number(m.move_id) !== STRUGGLE_ID)
  const sabidosIds = new Set(sabidos.map(m => Number(m.move_id)))

  // Nombre y descripción de todas las habilidades que se van a mostrar
  const abIds = [...new Set(evos.flatMap(e => habilidadesDe(e).map(a => a.id)))]
  const { rows: abRows } = abIds.length
    ? await run(`SELECT ability_id, ability_name, ability_description FROM ${TABI} WHERE ability_id = ANY($1::int[])`, [abIds])
    : { rows: [] }
  const abPorId = new Map(abRows.map(a => [Number(a.ability_id), a]))

  // ¿La pasiva actual es la oculta de su especie? (llegó por un feat)
  const pasivaId = pasiva?.id_abilitie != null ? Number(pasiva.id_abilitie) : null
  const pasivaEraOculta = pasivaId != null && [1, 2, 3, 4].some(n =>
    Number(pp[`old_ab_${n}`]) === pasivaId && Number(pp[`old_ab_${n}_hidden`]) === 1)

  const pospuesta = pp.personaje_pokemon_evo_pospuesta_nivel != null
    && ctx.nivel <= Number(pp.personaje_pokemon_evo_pospuesta_nivel)

  const opciones = evos.map(e => {
    const condiciones = evaluarCondiciones(e, ctx)
    const habs = habilidadesDe(e)
    const conserva = pasivaId == null || habs.some(a => a.id === pasivaId)
    const elegibles = habs
      .filter(a => !a.hidden || pasivaEraOculta)
      .map(a => ({ id: a.id, hidden: a.hidden, nombre: abPorId.get(a.id)?.ability_name || `#${a.id}`, descripcion: abPorId.get(a.id)?.ability_description || null }))
    const soportada = norm(e.evolution_effect_type) === 'asi'
    const claves = new Set(poolPorEvo.get(Number(e.evolution_id)) || [])
    const nuevos = poolRows.filter(m => claves.has(claveMove(m.move_name)) && !sabidosIds.has(Number(m.move_id)))
    return {
      evolution_id: Number(e.evolution_id),
      destino: {
        pokemon_id: Number(e.evolution_to_pokemon_id),
        nombre: e.pokemon_name,
        sprite: e.pokemon_media_main || e.pokemon_media_sprite,
        sprite_shiny: e.pokemon_media_main_shiny || null,
        tipo_1: e.pokemon_type_1, tipo_2: e.pokemon_type_2,
        hit_dice: e.pokemon_hit_dice, ac: e.pokemon_armor_class,
        saving_throws: e.pokemon_saving_throws, skills: e.pokemon_proficient_skills,
      },
      puntos: soportada ? Number(e.evolution_effect_value) || 0 : 0,
      soportada,
      efecto_especial: soportada ? null : e.evolution_effect_value,
      condiciones,
      disponible: soportada && !pospuesta && condiciones.every(c => c.cumple !== false),
      conserva_pasiva: conserva,
      pasivas_elegibles: elegibles,
      movimientos_nuevos: nuevos,
    }
  })

  return { pp, ctx, stats, pasiva, pospuesta, opciones, evos, sabidos, maxMoves }
}

const statsBase = (stats) => Object.fromEntries(STAT_KEYS.map(k => [k, Number(stats[`pokemon_${k}`]) || 0]))

/** GET: las evoluciones posibles, con sus condiciones ya verificadas. */
const opciones = async (id_personaje, id_personaje_pokemon) => {
  const c = await contexto(id_personaje, id_personaje_pokemon)
  if (!c) return { error: 'notfound' }
  return {
    especie: c.pp.especie,
    apodo: c.pp.pokemon_apodo,
    nivel: c.ctx.nivel,
    hp_ganado: 2 * c.ctx.nivel,
    tope_stat: topeStat(c.ctx.nivel),
    hit_dice_actual: c.pp.pokemon_hit_dice,
    ac_actual: c.pp.personaje_pokemon_ac,
    pospuesta: c.pospuesta,
    stats: statsBase(c.stats),
    stats_bonus: Object.fromEntries(STAT_KEYS.map(k => [k, Number(c.stats[`pokemon_${k}_bonus`]) || 0])),
    pasiva_actual: c.pasiva ? { id: Number(c.pasiva.id_abilitie), nombre: c.pasiva.ability_name } : null,
    movimientos_actuales: c.sabidos,
    max_moves: c.maxMoves,
    opciones: c.opciones,
  }
}

const typeId = async (run, name) => {
  if (!name) return null
  const { rows } = await run(
    `SELECT pokemon_types_id FROM ${TTYP} WHERE lower(trim(pokemon_types_name)) = lower(trim($1))`, [name])
  return rows[0]?.pokemon_types_id ?? null
}

/** POST: aplica la evolución elegida. Todo se revalida aquí, no en el cliente. */
const evolucionar = async (id_personaje, id_personaje_pokemon, { evolution_id, stat_adds, id_abilitie, confirmadas, move_ids }) => {
  return transaction(async (client) => {
    const run = (t, p) => client.query(t, p)
    // Bloquea la fila: un doble clic no puede evolucionarlo dos veces
    const { rows: lock } = await run(
      `SELECT id_personaje_pokemon FROM ${TPP} WHERE id_personaje_pokemon = $1 AND id_personaje = $2 FOR UPDATE`,
      [id_personaje_pokemon, id_personaje])
    if (!lock.length) return { error: 'notfound' }

    const c = await contexto(id_personaje, id_personaje_pokemon, run)
    const op = c.opciones.find(o => o.evolution_id === Number(evolution_id))
    if (!op) return { error: 'opcion' }
    if (c.pospuesta) return { error: 'pospuesta' }
    if (!op.soportada) return { error: 'especial' }
    if (op.condiciones.some(x => x.cumple === false)) return { error: 'condicion' }
    const conf = new Set((Array.isArray(confirmadas) ? confirmadas : []).map(Number))
    if (op.condiciones.some((x, i) => x.cumple === null && !conf.has(i))) return { error: 'confirmar' }

    const base = statsBase(c.stats)
    const adds = Object.fromEntries(STAT_KEYS.map(k => [k, Number(stat_adds?.[k] ?? 0)]))
    const vp = validarPuntos(base, adds, op.puntos, c.ctx.nivel)
    if (vp.error) return { error: 'puntos', detalle: vp.error, debe: vp.debe, tope: vp.tope }

    let nuevaPasiva = null
    if (!op.conserva_pasiva) {
      nuevaPasiva = Number(id_abilitie)
      if (!op.pasivas_elegibles.some(a => a.id === nuevaPasiva)) return { error: 'pasiva' }
    }

    // Movimientos elegidos: de los que ya sabe o de los nuevos de esta forma,
    // al menos uno y sin pasar su tope (4, o más con Extra Move). Struggle no
    // cuenta: siempre se conserva.
    if (!Array.isArray(move_ids)) return { error: 'movimientos' }
    const elegidos = [...new Set(move_ids.map(Number).filter(n => Number.isInteger(n) && n !== STRUGGLE_ID))]
    const validos = new Set([...c.sabidos.map(m => Number(m.move_id)), ...op.movimientos_nuevos.map(m => Number(m.move_id))])
    if (!elegidos.length || elegidos.length > c.maxMoves || elegidos.some(id => !validos.has(id))) {
      return { error: 'movimientos', max: c.maxMoves }
    }

    const pk = c.evos.find(e => Number(e.evolution_id) === op.evolution_id)
    const nivel = c.ctx.nivel
    const hpGanado = 2 * nivel

    // 1. El item de la condición se consume (1 unidad de la mochila)
    for (const cond of op.condiciones) {
      if (cond.tipo !== 'item' || cond.cumple !== true) continue
      const { rowCount } = await run(
        `UPDATE ${TEQ} SET personaje_equipo_cantidad = personaje_equipo_cantidad - 1
          WHERE id_personaje_equipo = (
            SELECT eq.id_personaje_equipo FROM ${TEQ} eq JOIN ${TIT} i ON i.item_id = eq.id_item
             WHERE eq.id_personaje = $1 AND eq.personaje_equipo_cantidad > 0
               AND ${SQL_CLAVE_MOVE('i.item_name')} = $2
             ORDER BY eq.id_personaje_equipo LIMIT 1)`,
        [id_personaje, claveMove(cond.valor)])
      if (!rowCount) return { error: 'condicion' }
    }

    // 2. La especie y todo lo que se copió de ella al crear el Pokémon.
    // El apodo se cambia solo si nunca lo renombraron (sigue siendo el de la especie).
    const renombrar = norm(c.pp.pokemon_apodo) === norm(c.pp.especie)
    const t1 = await typeId(run, pk.pokemon_type_1)
    const t2 = await typeId(run, pk.pokemon_type_2)
    const { rows: upd } = await run(
      `UPDATE ${TPP} SET
         id_pokemon = $2,
         pokemon_hp = COALESCE(pokemon_hp, 0) + $3,
         pokemon_current_hp = COALESCE(pokemon_current_hp, 0) + $3,
         pokemon_hit_dice = $4,
         personaje_pokemon_ac = $5,
         personaje_pokemon_speed1_name = $6,  personaje_pokemon_speed1_value = $7,
         personaje_pokemon_speed2_name = $8,  personaje_pokemon_speed2_value = $9,
         personaje_pokemon_speed3_name = $10, personaje_pokemon_speed3_value = $11,
         personaje_pokemon_speed4_name = $12, personaje_pokemon_speed4_value = $13,
         pokemon_sense_1_name = $14, pokemon_sense_1_value = $15,
         pokemon_sense_2_name = $16, pokemon_sense_2_value = $17,
         personaje_pokemon_type_1 = $18, personaje_pokemon_type_2 = $19,
         pokemon_saving_throw_prof = $20,
         pokemon_apodo = CASE WHEN $21 THEN $22 ELSE pokemon_apodo END,
         personaje_pokemon_evo_pospuesta_nivel = NULL
       WHERE id_personaje_pokemon = $1
       RETURNING pokemon_apodo`,
      [
        id_personaje_pokemon, pk.pokemon_id, hpGanado,
        `1${pk.pokemon_hit_dice || ''}`,
        pk.pokemon_armor_class != null ? Number(pk.pokemon_armor_class) : c.pp.personaje_pokemon_ac,
        pk.pokemon_speed_1_name ?? null, pk.pokemon_speed_1_value ?? null,
        pk.pokemon_speed_2_name ?? null, pk.pokemon_speed_2_value ?? null,
        pk.pokemon_speed_3_name ?? null, pk.pokemon_speed_3_value ?? null,
        pk.pokemon_speed_4_name ?? null, pk.pokemon_speed_4_value ?? null,
        pk.pokemon_sense_1_name ?? null, pk.pokemon_sense_1_value ?? null,
        pk.pokemon_sense_2_name ?? null, pk.pokemon_sense_2_value ?? null,
        t1, t2,
        unirLista(c.pp.pokemon_saving_throw_prof, pk.pokemon_saving_throws) || null,
        renombrar, pk.pokemon_name,
      ])

    // 3. Stats: los puntos van a la base. Las proficiencias nuevas se suman,
    // nunca se quitan las que ya tenía.
    const savingNuevos = new Set(splitList(pk.pokemon_saving_throws).map(norm))
    const sets = [], params = [id_personaje_pokemon]
    for (const k of STAT_KEYS) {
      if (adds[k] > 0) { params.push(adds[k]); sets.push(`pokemon_${k} = COALESCE(pokemon_${k}, 0) + $${params.length}`) }
      if (savingNuevos.has(k)) sets.push(`pokemon_stats_${k}_prof = true`)
    }
    if (sets.length) await run(`UPDATE ${TPS} SET ${sets.join(', ')} WHERE id_personaje_pokemon = $1`, params)

    // 4. Skills proficientes de la especie nueva (se suman)
    const skillsNuevas = splitList(pk.pokemon_proficient_skills).map(norm)
    if (skillsNuevas.length) {
      await run(
        `UPDATE ${TPSK} ps SET pokemon_skill_pref = true
           FROM ${TSK} s
          WHERE s.skill_id = ps.id_skill AND ps.id_personaje_pokemon = $1
            AND lower(trim(s.skill_name)) = ANY($2)`,
        [id_personaje_pokemon, skillsNuevas])
    }

    // 5. Pasiva: solo si la actual no existe en la forma nueva
    if (nuevaPasiva != null) {
      const { rowCount } = await run(`UPDATE ${TPPA} SET id_abilitie = $2 WHERE id_personaje_pokemon = $1`, [id_personaje_pokemon, nuevaPasiva])
      if (!rowCount) await run(`INSERT INTO ${TPPA} (id_abilitie, id_personaje_pokemon) VALUES ($1, $2)`, [nuevaPasiva, id_personaje_pokemon])
    }

    // 6. Movimientos: se quitan los que no eligió (Struggle se queda siempre)
    // y se agregan los nuevos con los PP llenos. Los que conserva mantienen
    // los PP que tenían.
    await run(
      `DELETE FROM ${TPPM} WHERE personaje_pokemon_moves_personaje_pokemon_id = $1
         AND personaje_pokemon_moves_move_id <> $2 AND NOT (personaje_pokemon_moves_move_id = ANY($3::int[]))`,
      [id_personaje_pokemon, STRUGGLE_ID, elegidos])
    for (const mid of elegidos) {
      if (c.sabidos.some(m => Number(m.move_id) === mid)) continue
      await run(
        `INSERT INTO ${TPPM} (personaje_pokemon_moves_move_id, personaje_pokemon_moves_personaje_pokemon_id,
                              personaje_pokemon_moves_current_pp, personaje_pokemon_moves_max_pp)
         SELECT $1, $2, COALESCE(m.move_pp, 0), COALESCE(m.move_pp, 0) FROM ${TMOV} m WHERE m.move_id = $1`,
        [mid, id_personaje_pokemon])
    }

    return {
      ok: true,
      de: c.pp.especie,
      a: pk.pokemon_name,
      apodo: upd[0]?.pokemon_apodo,
      hp_ganado: hpGanado,
      sprite: (c.pp.pokemon_is_shiny && pk.pokemon_media_main_shiny) ? pk.pokemon_media_main_shiny : (pk.pokemon_media_main || pk.pokemon_media_sprite),
      confirmadas_dm: op.condiciones.filter(x => x.cumple === null).map(x => x.texto),
    }
  })
}

/** Posponer: no puede volver a evolucionar hasta subir otro nivel. */
const posponer = async (id_personaje, id_personaje_pokemon) => {
  const { rows } = await query(
    `UPDATE ${TPP} SET personaje_pokemon_evo_pospuesta_nivel = pokemon_level
      WHERE id_personaje_pokemon = $1 AND id_personaje = $2
      RETURNING personaje_pokemon_evo_pospuesta_nivel AS nivel`,
    [id_personaje_pokemon, id_personaje])
  return rows[0] ? { ok: true, nivel: rows[0].nivel } : { error: 'notfound' }
}

module.exports = { opciones, evolucionar, posponer }
