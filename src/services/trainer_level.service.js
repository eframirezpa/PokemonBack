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
//  5. Un Pokémon RECIBIDO (pokemon_recibido) aporta como máximo el nivel del
//     entrenador. Recibir uno de nivel 20 siendo nivel 3 no regala niveles, y
//     su aporte crece según el entrenador sube. El nivel es a la vez entrada y
//     salida del cálculo, otra razón para iterar hasta que se estabilice.
//
// Recalcular es idempotente: si nada cambió, no escribe.
const { query, SCHEMA } = require('../config/db')

const T    = `"${SCHEMA}"."personaje"`
const TPP  = `"${SCHEMA}"."personaje_pokemon"`
const TREQ = `"${SCHEMA}"."trainer_pokemon_level_requirements"`
const TTL  = `"${SCHEMA}"."trainer_levels"`

const NIVEL_MAX = 20

// Suma de los `slots` aportes más altos. Mínimo 1: un entrenador sin Pokémon
// sigue contando 1, igual que al crear el personaje.
//
// Un Pokémon RECIBIDO (transferido por el máster o por otro entrenador) aporta
// como máximo el nivel del entrenador: recibir uno de nivel 20 siendo nivel 3
// no regala niveles, y su aporte va creciendo a medida que el entrenador sube.
// Los que consiguió por su cuenta aportan su nivel completo; si se les topara
// también, ningún entrenador podría subir nunca -- su propio Pokémon jamás
// aportaría más que él y el cálculo se quedaría clavado en el nivel 1.
//
// El orden es por APORTE y no por nivel bruto: si un recibido de nivel 10 está
// topado a 5 y hay uno propio de nivel 7, entra el propio, que es el que más
// suma. Ordenar por el nivel bruto elegiría el peor de los dos.
const pokeLevelsCon = async (id_personaje, slots, nivelTrainer, run) => {
  const { rows } = await run(
    `SELECT COALESCE(SUM(aporte), 0)::int AS total
       FROM (SELECT CASE WHEN pokemon_recibido
                         THEN LEAST(pokemon_level, $3::int)
                         ELSE pokemon_level END AS aporte
               FROM ${TPP}
              WHERE id_personaje = $1
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
    `SELECT personaje_level, personaje_pokelvls, personaje_pokeslots, personaje_prof
       FROM ${T} WHERE id_personaje = $1`, [id_personaje])
  if (!pRows[0]) return null

  const nivelPrevio    = Number(pRows[0].personaje_level)     || 1
  const pokelvlsPrevio = Number(pRows[0].personaje_pokelvls)  || 1
  const slotsPrevio    = Number(pRows[0].personaje_pokeslots) || 3
  const profPrevio     = Number(pRows[0].personaje_prof)      || 2

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

  const cambio = pokelvls !== pokelvlsPrevio || nivel !== nivelPrevio
              || slots !== slotsPrevio || prof !== profPrevio
  if (cambio) {
    await run(
      `UPDATE ${T}
          SET personaje_pokelvls   = $2,
              personaje_level      = $3,
              personaje_pokeslots  = $4,
              personaje_prof       = $5
        WHERE id_personaje = $1`,
      [id_personaje, pokelvls, nivel, slots, prof]
    )
  }

  // Los niveles atravesados, para que la UI sepa qué anunciar
  let ganados = []
  if (nivel > nivelPrevio) {
    const { rows } = await run(
      `SELECT * FROM ${TTL} WHERE trainer_level > $1 AND trainer_level <= $2 ORDER BY trainer_level`,
      [nivelPrevio, nivel])
    ganados = rows
  }

  return {
    id_personaje: Number(id_personaje),
    pokelvls, pokelvls_previo: pokelvlsPrevio,
    nivel,    nivel_previo: nivelPrevio,
    pokeslots: slots, pokeslots_previo: slotsPrevio,
    prof,      prof_previo: profPrevio,
    subio: nivel > nivelPrevio,
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
