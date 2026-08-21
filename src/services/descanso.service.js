// Descansos largo y corto del entrenador y sus Pokémon.
//
// El DM aprueba el descanso fuera de la app; aquí solo se aplica el efecto.
//
// LARGO: deja a los elegidos como nuevos. Cura al máximo, baja un nivel de
//   agotamiento, limpia las muertes salvadas/falladas, devuelve todos los dados
//   de golpe y rellena los recursos gastables (Extra Points de la ruta, los
//   puntos que dan los feats como Lucky Points, los usos de las features de
//   nivel (Pokemon Tracker, Master Trainer), y los PP de los movimientos del
//   Pokémon).
//
// CORTO: lo toma UNO solo. Gasta dados de golpe y cura lo que saque la tirada,
//   que la escribe el jugador a mano igual que en la subida de nivel, MÁS el
//   modificador de CON por cada dado gastado.
//
// El HP máximo NUNCA está en la base: se calcula en vivo (modificador de CON por
// nivel más el healing de feats). Por eso los máximos se resuelven ANTES de
// abrir la transacción: findFullById y findPokemonDetail piden conexión al pool
// y llamarlos dentro del callback dejaría la transacción esperando su propia
// conexión con un pool pequeño.
const { query, transaction, SCHEMA } = require('../config/db')
const { effectiveMaxHp, conMod, trainerCon, pokemonCon } = require('../lib/hp')
const { hitDiceMax } = require('../lib/hitdice')
const { maximoOCero, maximoEnProsa } = require('../lib/recurso_formula')
const { recursosDeFeats } = require('../lib/feat_recursos')
const { reponerFeatures } = require('../lib/features_nivel')
const { extraDelRasgo } = require('../lib/bond')
const { findFullById, findPokemonDetail } = require('./personaje.service')

const T    = `"${SCHEMA}"."personaje"`
const TPP  = `"${SCHEMA}"."personaje_pokemon"`
const TPPM = `"${SCHEMA}"."personaje_pokemon_moves"`
const TPPB = `"${SCHEMA}"."personaje_path_bonus"`
const TB   = `"${SCHEMA}"."bonds"`

const entero = (v, def = 0) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? n : def }

// ── Quiénes pueden descansar ────────────────────────────────────────────────
// El entrenador y todos los Pokémon en su posesión. Viajan también el dado y
// los dados disponibles, que es lo que necesita el descanso corto.
const participantes = async (id_personaje) => {
  const { rows: pj } = await query(
    `SELECT id_personaje, nombre_personaje, personaje_hit_dice,
            COALESCE(personaje_hit_dice_left, 0) AS dados,
            COALESCE(hit_dice_pool, 0) AS dados_max,
            COALESCE(personaje_current_hp, 0) AS hp
       FROM ${T} WHERE id_personaje = $1`, [id_personaje])
  if (!pj[0]) return { error: 'notfound' }

  const { rows: pks } = await query(
    `SELECT id_personaje_pokemon, pokemon_apodo, pokemon_hit_dice,
            COALESCE(pokemon_hit_dice_left, 0) AS dados,
            COALESCE(hit_dice_pool, 0) AS dados_max,
            COALESCE(pokemon_current_hp, 0) AS hp
       FROM ${TPP} WHERE id_personaje = $1
      ORDER BY pokemon_apodo, id_personaje_pokemon`, [id_personaje])

  return {
    entrenador: {
      id: Number(pj[0].id_personaje),
      nombre: pj[0].nombre_personaje,
      hit_dice: pj[0].personaje_hit_dice || null,
      cara: hitDiceMax(pj[0].personaje_hit_dice),
      dados: entero(pj[0].dados), dados_max: entero(pj[0].dados_max),
      hp: entero(pj[0].hp), caido: entero(pj[0].hp) <= 0,
    },
    pokemons: pks.map(p => ({
      id: Number(p.id_personaje_pokemon),
      apodo: p.pokemon_apodo,
      hit_dice: p.pokemon_hit_dice || null,
      cara: hitDiceMax(p.pokemon_hit_dice),
      dados: entero(p.dados), dados_max: entero(p.dados_max),
      hp: entero(p.hp), caido: entero(p.hp) <= 0,
    })),
  }
}

// Máximo de un recurso de ruta: el valor está en la columna del personaje que
// nombra personaje_path_bonus_value. Misma regla que setPathResource.
const maximosDeRuta = async (id_personaje) => {
  const { rows } = await query(
    `SELECT personaje_path_bonus_id AS id, personaje_path_bonus_type AS tipo,
            personaje_path_bonus_value AS columna
       FROM ${TPPB}
      WHERE personaje_path_bonus_personaje_id = $1
        AND lower(personaje_path_bonus_type) IN ('resource', 'battle dice')`, [id_personaje])
  if (!rows.length) return []
  // Los Battle Dice también vuelven con el descanso, pero su tope sale de una
  // fórmula en prosa y no de una columna del personaje.
  return Promise.all(rows.map(async r => ({
    id: r.id,
    maximo: String(r.tipo || '').toLowerCase() === 'battle dice'
      ? ((await maximoEnProsa(r.columna, id_personaje, 'minimum 1')) ?? 0)
      : await maximoOCero(r.columna, { id_personaje }),
  })))
}

// ── Descanso largo ──────────────────────────────────────────────────────────
const longRest = async (id_personaje, { entrenador = false, pokemons = [] } = {}) => {
  const ids = [...new Set((Array.isArray(pokemons) ? pokemons : []).map(Number).filter(Boolean))]
  if (!entrenador && !ids.length) return { error: 'empty' }

  // Solo Pokémon de este entrenador: la lista llega del cliente. Y solo los que
  // sigan en pie: un descanso largo cura y repone, no revive. Quien esté en 0
  // puntos de vida se omite y se informa, en vez de tumbar todo el descanso.
  let propios = []
  const omitidos = []
  if (ids.length) {
    const { rows } = await query(
      `SELECT id_personaje_pokemon, pokemon_apodo, COALESCE(pokemon_current_hp, 0) AS hp
         FROM ${TPP}
        WHERE id_personaje = $1 AND id_personaje_pokemon = ANY($2::int[])`, [id_personaje, ids])
    for (const r of rows) {
      if (entero(r.hp) > 0) propios.push(Number(r.id_personaje_pokemon))
      else omitidos.push(r.pokemon_apodo)
    }
  }

  // ── Máximos, fuera de la transacción ──
  let hpEntrenador = null
  let vaElEntrenador = false
  if (entrenador) {
    const full = await findFullById(id_personaje)
    if (!full) return { error: 'notfound' }
    if (entero(full.personaje_current_hp) > 0) {
      vaElEntrenador = true
      hpEntrenador = effectiveMaxHp(full)
    } else {
      omitidos.push(full.nombre_personaje)
    }
  }

  if (!vaElEntrenador && !propios.length) {
    return omitidos.length ? { error: 'caidos', omitidos } : { error: 'notfound' }
  }
  const hpPokemon = new Map()
  for (const idpp of propios) {
    const d = await findPokemonDetail(idpp)
    if (d) hpPokemon.set(idpp, entero(d.pokemon_hp))
  }
  const recursos = vaElEntrenador ? await maximosDeRuta(id_personaje) : []
  // Los puntos de los feats se reponen igual que los de ruta
  const recursosFeat = vaElEntrenador ? await recursosDeFeats(id_personaje) : []
  // El nivel decide si tiene Pokemon Tracker que reponer
  const { rows: nv } = await query(`SELECT personaje_level FROM ${T} WHERE id_personaje = $1`, [id_personaje])
  const nivelEntrenador = entero(nv[0]?.personaje_level)
  // El punto que suma el rasgo al pool de vínculo, si el entrenador lo tiene
  const extraBond = await extraDelRasgo(id_personaje)

  return transaction(async (client) => {
    const hecho = { entrenador: false, pokemons: [], recursos: 0, movimientos: 0, omitidos }

    if (vaElEntrenador) {
      await client.query(
        `UPDATE ${T}
            SET personaje_current_hp    = $2,
                personaje_exahust_lvl   = GREATEST(COALESCE(personaje_exahust_lvl, 0) - 1, 0),
                personaje_dsts          = 0,
                personaje_dstf          = 0,
                personaje_hit_dice_left = COALESCE(hit_dice_pool, 0)
          WHERE id_personaje = $1`,
        [id_personaje, hpEntrenador])

      // Extra Points de la ruta, cada uno a su propio máximo
      for (const r of recursos) {
        await client.query(
          `UPDATE ${TPPB} SET personaje_path_bonus_target = $2 WHERE personaje_path_bonus_id = $1`,
          [r.id, String(r.maximo)])
      }
      // Features de nivel: sus usos vuelven con el descanso, como todo lo demás
      await reponerFeatures((t, p) => client.query(t, p), id_personaje, nivelEntrenador)

      // Puntos de los feats: mismo trato, otra tabla
      for (const r of recursosFeat) {
        await client.query(
          `UPDATE "${SCHEMA}"."personaje_feat_bonus"
              SET personaje_feat_bonus_value = $2
            WHERE personaje_feat_bonus_id = $1`,
          [r.id, String(r.maximo)])
      }
      hecho.entrenador = true
      hecho.recursos = recursos.length + recursosFeat.length
    }

    for (const idpp of propios) {
      await client.query(
        `UPDATE ${TPP}
            SET pokemon_current_hp             = $2,
                personaje_pokemon_exahust_lvl  = GREATEST(COALESCE(personaje_pokemon_exahust_lvl, 0) - 1, 0),
                personaje_pokemon_dsts         = 0,
                personaje_pokemon_dstf         = 0,
                pokemon_hit_dice_left          = COALESCE(hit_dice_pool, 0)
          WHERE id_personaje_pokemon = $1`,
        [idpp, hpPokemon.get(idpp) ?? 0])

      // Bond points al tope efectivo: los del nivel más el punto del rasgo, que
      // ahora forma parte del pool y se gasta como cualquier otro.
      await client.query(
        `UPDATE ${TPP} pp
            SET personaje_pokemon_bond_current_points =
                  COALESCE(pp.personaje_pokemon_bond_points, 0)
                  + CASE WHEN COALESCE(b.bond_level, 0) > 0 THEN $2::int ELSE 0 END
           FROM ${TB} b
          WHERE b.bond_id = pp.personaje_pokemon_bond
            AND pp.id_personaje_pokemon = $1`, [idpp, extraBond])

      // PP al tope. Un movimiento con máximo 0 es ilimitado y se queda igual.
      const { rowCount } = await client.query(
        `UPDATE ${TPPM}
            SET personaje_pokemon_moves_current_pp = personaje_pokemon_moves_max_pp
          WHERE personaje_pokemon_moves_personaje_pokemon_id = $1
            AND COALESCE(personaje_pokemon_moves_max_pp, 0) > 0
            AND personaje_pokemon_moves_current_pp IS DISTINCT FROM personaje_pokemon_moves_max_pp`,
        [idpp])
      hecho.movimientos += rowCount || 0
      hecho.pokemons.push(idpp)
    }

    return hecho
  })
}

// ── Descanso corto ──────────────────────────────────────────────────────────
// Lo toma uno solo. Gasta `dados` de los disponibles y suma al HP actual la
// tirada más el modificador de CON por cada dado, sin pasar del máximo.
//
// Solo se valida la TIRADA, que es lo que escribe el jugador: nunca menos de un
// 1 por dado ni más de la cara del dado por dado. El modificador lo pone el
// servidor a partir de las características, así que no viaja en la petición y no
// hay nada que comprobar.
//
// Con un CON bajo el modificador es negativo y resta. La curación total se
// queda en 0 como mínimo: un descanso puede no servir de nada, pero no puede
// hacer daño.
const shortRest = async (id_personaje, { objetivo, idpp, dados, resultado } = {}) => {
  const esPokemon = objetivo === 'pokemon'
  const n = entero(dados, 0)
  const cura = entero(resultado, 0)

  let fila, maximoHp, cara, actualHp, disponibles, modCon = 0
  if (esPokemon) {
    const { rows } = await query(
      `SELECT pokemon_hit_dice AS dado, COALESCE(pokemon_hit_dice_left, 0) AS dados,
              COALESCE(pokemon_current_hp, 0) AS actual
         FROM ${TPP} WHERE id_personaje_pokemon = $1 AND id_personaje = $2`,
      [entero(idpp), id_personaje])
    fila = rows[0]
    if (!fila) return { error: 'notfound' }
    const d = await findPokemonDetail(entero(idpp))
    maximoHp = entero(d?.pokemon_hp)
    modCon = conMod(pokemonCon(d?.stats, d?.feats))
  } else {
    const { rows } = await query(
      `SELECT personaje_hit_dice AS dado, COALESCE(personaje_hit_dice_left, 0) AS dados,
              COALESCE(personaje_current_hp, 0) AS actual
         FROM ${T} WHERE id_personaje = $1`, [id_personaje])
    fila = rows[0]
    if (!fila) return { error: 'notfound' }
    const full = await findFullById(id_personaje)
    maximoHp = effectiveMaxHp(full)
    modCon = conMod(trainerCon(full))
  }

  cara = hitDiceMax(fila.dado)
  actualHp = entero(fila.actual)
  disponibles = entero(fila.dados)

  if (n < 1 || n > disponibles) return { error: 'dados', disponibles }
  if (cura < n || cura > n * cara) return { error: 'tirada', min: n, max: n * cara }

  const bonoCon = modCon * n
  const curacion = Math.max(0, cura + bonoCon)
  const hpNuevo = Math.min(actualHp + curacion, maximoHp)
  const dadosNuevo = disponibles - n

  return transaction(async (client) => {
    if (esPokemon) {
      await client.query(
        `UPDATE ${TPP} SET pokemon_current_hp = $2, pokemon_hit_dice_left = $3
          WHERE id_personaje_pokemon = $1`, [entero(idpp), hpNuevo, dadosNuevo])
    } else {
      await client.query(
        `UPDATE ${T} SET personaje_current_hp = $2, personaje_hit_dice_left = $3
          WHERE id_personaje = $1`, [id_personaje, hpNuevo, dadosNuevo])
    }
    return {
      current_hp: hpNuevo, max_hp: maximoHp,
      curado: hpNuevo - actualHp, dados: dadosNuevo,
      // Desglose, para que el panel pueda explicar el número: la tirada del
      // jugador y lo que puso el CON.
      tirada: cura, mod_con: modCon, bono_con: bonoCon,
    }
  })
}

module.exports = { participantes, longRest, shortRest }
