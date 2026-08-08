// Nivel del entrenador. Se deriva de los niveles de sus Pokémon, no de XP.
//
// REGLAS
//  1. personaje_pokelvls = suma de los niveles de los Pokémon MÁS ALTOS del
//     entrenador, tomando tantos como pokéslots tenga. Cuentan los del
//     cinturón y los de la femputadora por igual.
//  2. El nivel es el mayor de trainer_pokemon_level_requirements cuyo umbral
//     ya se alcanzó.
//  3. El nivel NUNCA baja. pokelvls sí puede bajar (liberar o entregar un
//     Pokémon), y eso no le quita el nivel ya conseguido.
//  4. Subir de nivel puede otorgar un pokéslot (niveles 5, 10 y 15). Un slot
//     más hace entrar otro Pokémon en la cuenta, lo que sube pokelvls, lo que
//     puede desencadenar otro nivel. Por eso se recalcula hasta estabilizar.
//  5. Cuánto aporta cada Pokémon depende de su pokemon_tag: 'starter' completo,
//     'transfer' nada, y el resto topado al nivel del entrenador. Su propio
//     starter (personaje_starter_pokemon_id) aporta completo aunque vuelva
//     etiquetado como 'transfer'. Ver pokeLevelsCon. Como el nivel es a la vez
//     entrada y salida del cálculo, hay que iterar hasta que se estabilice.
//
// Recalcular es idempotente: si nada cambió, no escribe.
const { query, SCHEMA } = require('../config/db')

const T    = `"${SCHEMA}"."personaje"`
const TPP  = `"${SCHEMA}"."personaje_pokemon"`
const TREQ = `"${SCHEMA}"."trainer_pokemon_level_requirements"`
const TTL  = `"${SCHEMA}"."trainer_levels"`
const TPI  = `"${SCHEMA}"."personaje_pending_improvement"`
const TPI_PB = `"${SCHEMA}"."personaje_path_bonus"`

const NIVEL_MAX = 20

// Suma de los `slots` aportes más altos. Mínimo 1: un entrenador sin Pokémon
// sigue contando 1, igual que al crear el personaje.
//
// Cuánto aporta cada Pokémon lo decide su pokemon_tag:
//
//   starter   → su nivel completo. Es el inicial del lobby, lo único que un
//               entrenador consigue por su cuenta; si también se le topara,
//               nadie podría subir nunca (su propio Pokémon jamás aportaría más
//               que él y el cálculo se quedaría clavado en el nivel 1).
//   transfer  → nada. Viene de otro entrenador, así que no vale para subir.
//   resto     → como máximo el nivel del entrenador. Cubre 'created' y
//               cualquier etiqueta que el máster invente: todo lo que sale de
//               sus manos se topa, para que recibir un nivel 20 siendo nivel 3
//               no regale niveles. El tope se afloja según el entrenador sube.
//
// EXCEPCIÓN: el Pokémon cuyo id figura en personaje_starter_pokemon_id aporta
// completo pase lo que pase. Es el propio starter del entrenador: si lo entregó
// y se lo devolvieron, llega con tag 'transfer' pero sigue siendo suyo.
//
// El orden es por APORTE y no por nivel bruto: si un 'created' de nivel 10 está
// topado a 5 y hay un starter de nivel 7, entra el starter, que es el que más
// suma. Ordenar por el nivel bruto elegiría el peor de los dos.
const pokeLevelsCon = async (id_personaje, slots, nivelTrainer, run) => {
  const { rows } = await run(
    `SELECT COALESCE(SUM(aporte), 0)::int AS total
       FROM (SELECT CASE
                      WHEN pp.id_personaje_pokemon =
                           (SELECT personaje_starter_pokemon_id FROM ${T} WHERE id_personaje = $1)
                        THEN pp.pokemon_level
                      WHEN lower(coalesce(pp.pokemon_tag, '')) = 'transfer' THEN 0
                      WHEN lower(coalesce(pp.pokemon_tag, '')) = 'starter'  THEN pp.pokemon_level
                      ELSE LEAST(pp.pokemon_level, $3::int)
                    END AS aporte
               FROM ${TPP} pp
              WHERE pp.id_personaje = $1
              ORDER BY aporte DESC
              LIMIT $2::int) mejores`,
    [id_personaje, Math.max(0, Number(slots) || 0), Math.max(1, Number(nivelTrainer) || 1)]
  )
  return Math.max(1, Number(rows[0]?.total) || 0)
}

// Mayor nivel cuyo umbral se alcanzó. Se usa >= y no =, a propósito: pokelvls
// salta de golpe (capturar un Pokémon de nivel 10, evolucionar, recibir una
// transferencia), así que casi nunca cae justo en el umbral. Con igualdad
// estricta un entrenador que pasara de 2 a 4 no llegaría nunca al nivel 2.
const nivelParaTotal = async (total, run) => {
  const { rows } = await run(
    `SELECT COALESCE(MAX(trainer_level), 1) AS nivel
       FROM ${TREQ} WHERE trainer_total_pokemon_levels_required <= $1`,
    [Number(total) || 0]
  )
  return Number(rows[0]?.nivel) || 1
}

const filaNivel = async (nivel, run) => {
  const { rows } = await run(`SELECT * FROM ${TTL} WHERE trainer_level = $1`, [nivel])
  return rows[0] || null
}

/**
 * Recalcula pokelvls y nivel de un personaje y los persiste si cambiaron.
 * @param run  ejecutor de queries; pásale el client si estás en una transacción
 * @returns null si el personaje no existe, o el detalle del recálculo
 */
const recalcular = async (id_personaje, run = query) => {
  const { rows: pRows } = await run(
    `SELECT personaje_level, personaje_pokelvls, personaje_pokeslots, personaje_prof, personaje_sr
       FROM ${T} WHERE id_personaje = $1`, [id_personaje])
  if (!pRows[0]) return null

  const nivelPrevio    = Number(pRows[0].personaje_level)     || 1
  const pokelvlsPrevio = Number(pRows[0].personaje_pokelvls)  || 1
  const slotsPrevio    = Number(pRows[0].personaje_pokeslots) || 3
  const profPrevio     = Number(pRows[0].personaje_prof)      || 2
  const srPrevio       = Number(pRows[0].personaje_sr)        || 0

  let nivel = nivelPrevio
  let slots = slotsPrevio
  let pokelvls = pokelvlsPrevio

  // Converge en pocas vueltas (solo 3 niveles dan slot). El tope es una red
  // de seguridad para que un dato raro no deje el bucle girando.
  for (let vuelta = 0; vuelta < NIVEL_MAX; vuelta++) {
    // El nivel entra en el cálculo como tope de los recibidos, así que al subir
    // hay que rehacer la cuenta: la vuelta siguiente lo recalcula con el nuevo.
    pokelvls = await pokeLevelsCon(id_personaje, slots, nivel, run)
    const nivelCalculado = await nivelParaTotal(pokelvls, run)

    // Regla 3: el nivel nunca baja
    const nivelNuevo = Math.max(nivel, nivelCalculado)
    const fila = await filaNivel(nivelNuevo, run)
    // Los slots tampoco bajan: si el máster otorgó alguno extra, se respeta
    const slotsNuevo = Math.max(slots, Number(fila?.trainer_level_pokeslots) || slots)

    if (nivelNuevo === nivel && slotsNuevo === slots) break
    nivel = nivelNuevo
    slots = slotsNuevo
  }

  const fila = await filaNivel(nivel, run)
  const prof = Number(fila?.trainer_level_proficiency_bonus) || profPrevio

  // El SR se toca SOLO cuando el nivel sube de verdad, no en cada recálculo.
  // Los otros tres son derivados y volver a escribirlos no cambia nada, pero el
  // SR se gasta durante la partida: refrescarlo porque un Pokémon subió de nivel
  // se lo devolvería entero. Se sube al tope del nivel nuevo, y nunca se baja
  // por si el máster concedió alguno de más.
  const subio = nivel > nivelPrevio
  // El tope incluye los bonos permanentes de la ruta (max_sr_bonus). Sin esto,
  // la siguiente subida pisaría el punto ganado al fijar el máximo del nivel.
  let bonoSr = 0
  if (subio) {
    const { rows: bs } = await run(
      `SELECT COALESCE(SUM(NULLIF(regexp_replace(personaje_path_bonus_value, '[^0-9-]', '', 'g'), '')::int), 0) AS extra
         FROM ${TPI_PB} WHERE personaje_path_bonus_personaje_id = $1
          AND lower(personaje_path_bonus_type) = 'max_sr_bonus'`, [id_personaje])
    bonoSr = Number(bs[0]?.extra) || 0
  }
  const sr = subio
    ? Math.max(srPrevio, (Number(fila?.trainer_level_max_sr) || 0) + bonoSr || srPrevio)
    : srPrevio

  const cambio = pokelvls !== pokelvlsPrevio || nivel !== nivelPrevio
              || slots !== slotsPrevio || prof !== profPrevio || sr !== srPrevio
  if (cambio) {
    await run(
      `UPDATE ${T}
          SET personaje_pokelvls   = $2,
              personaje_level      = $3,
              personaje_pokeslots  = $4,
              personaje_prof       = $5,
              personaje_sr         = $6,
              -- Un dado más por cada nivel ganado, sin pasar del total; la
              -- reserva queda siempre en el nivel. La resta usa el
              -- personaje_level viejo, así que cubre los saltos de varios
              -- niveles de una vez, que aquí sí ocurren: pokelvls avanza a
              -- tirones y puede cruzar dos umbrales en el mismo evento.
              personaje_hit_dice_left = LEAST(
                COALESCE(personaje_hit_dice_left, 0) + GREATEST($3 - personaje_level, 0), $3),
              hit_dice_pool = $3
        WHERE id_personaje = $1`,
      [id_personaje, pokelvls, nivel, slots, prof, sr]
    )
  }

  // Los niveles atravesados, para que la UI sepa qué anunciar
  let ganados = []
  if (subio) {
    const { rows } = await run(
      `SELECT * FROM ${TTL} WHERE trainer_level > $1 AND trainer_level <= $2 ORDER BY trainer_level`,
      [nivelPrevio, nivel])
    ganados = rows

    // Un pendiente por nivel ganado. Las features se copian del catálogo: si
    // este cambiara, lo que quedó pendiente sigue siendo lo prometido al subir.
    // ON CONFLICT porque recalcular() corre en cada evento de Pokémon y no debe
    // duplicar ni resucitar un nivel ya confirmado.
    for (const g of ganados) {
      await run(
        `INSERT INTO ${TPI} (
           personaje_pending_improvement_personaje_id,
           personaje_pending_improvement_lvl,
           personaje_pending_improvement_features
         ) VALUES ($1, $2, $3)
         ON CONFLICT ON CONSTRAINT personaje_pending_improvement_unico DO NOTHING`,
        [id_personaje, g.trainer_level, g.trainer_level_features ?? null]
      )
    }
  }

  return {
    id_personaje: Number(id_personaje),
    pokelvls, pokelvls_previo: pokelvlsPrevio,
    nivel,    nivel_previo: nivelPrevio,
    pokeslots: slots, pokeslots_previo: slotsPrevio,
    prof,      prof_previo: profPrevio,
    sr,        sr_previo: srPrevio,
    subio,
    niveles_ganados: ganados,
    persistido: cambio,
  }
}

// Versión silenciosa para los sitios donde el recálculo es un efecto
// secundario (capturar, liberar, transferir, subir de nivel un Pokémon) y un
// fallo aquí no debe tumbar la operación principal, que ya está hecha.
const recalcularSeguro = async (id_personaje, run = query) => {
  try { return await recalcular(id_personaje, run) } catch (e) {
    console.error(`recalcular nivel del personaje ${id_personaje}:`, e.message)
    return null
  }
}

module.exports = { recalcular, recalcularSeguro, pokeLevelsCon, nivelParaTotal }
