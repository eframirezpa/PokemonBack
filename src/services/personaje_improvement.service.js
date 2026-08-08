// Mejoras de nivel del entrenador: qué queda pendiente y cómo se confirma.
//
// Se resuelven de UNO EN UNO, del nivel más bajo al más alto: un entrenador
// puede cruzar varios niveles de golpe y cada nivel trae sus propias features.
// Confirmar un nivel lo marca aplicado, así que interrumpir a mitad conserva lo
// ya elegido.
//
// Lo que persiste cada feature:
//   Ability Score Improvement → personaje_stats (2 puntos)
//   Specialization            → personaje_specializations_bonus
//   Trainer's Resolve         → personaje_stats_<stat>_prof
//   Tirada de hit dice        → personaje_hp y personaje_current_hp, en todos
//                               los niveles (igual que en los Pokémon)
//   Control Upgrade, Pokeslot → nada: ya los aplicó trainer_level.service al
//                               subir; aquí solo se informan
//   Epic Boon, Master Trainer,
//   Pokemon Tracker           → solo aviso
//   Trainer Path              → personaje.personaje_path, y de paso los bonos
//                               que la ruta da en ese nivel
//   Trainer Path Feature      → personaje_path_bonus, los bonos de la ruta ya
//                               elegida para el nivel que se confirma
const { query, transaction, SCHEMA } = require('../config/db')
const { previewStab } = require('../lib/stab')
const { previewBond, aplicarBonoBond, sincronizarBondSeguro } = require('../lib/bond')
const { hitDiceMax } = require('../lib/hitdice')

const T     = `"${SCHEMA}"."personaje"`
const TS    = `"${SCHEMA}"."personaje_stats"`
const TPI   = `"${SCHEMA}"."personaje_pending_improvement"`
const TTL   = `"${SCHEMA}"."trainer_levels"`
const TSPEC = `"${SCHEMA}"."specializations"`
const TPSB  = `"${SCHEMA}"."personaje_specializations_bonus"`
const TPATHS = `"${SCHEMA}"."paths"`
const TPB    = `"${SCHEMA}"."path_bonus"`
const TPPB   = `"${SCHEMA}"."personaje_path_bonus"`

const STAT_KEYS = ['dex', 'str', 'con', 'int', 'wis', 'cha']
const ASI_PUNTOS = 2
const STAT_CAP = 20

const norm = s => (s ?? '').toLowerCase().trim()
const splitFeatures = s => (s || '').split(',').map(x => x.trim()).filter(Boolean)
const tiene = (features, nombre) => splitFeatures(features).some(f => norm(f) === norm(nombre))

// Pendientes sin aplicar, del nivel más bajo al más alto. Cada uno viaja con lo
// que la ventana necesita para pintarse sin más viajes.
const listPending = async (id_personaje) => {
  const { rows } = await query(
    `SELECT pi.personaje_pending_improvement_id   AS id,
            pi.personaje_pending_improvement_lvl  AS lvl,
            pi.personaje_pending_improvement_features AS features,
            tl.trainer_level_feature_description  AS descripcion,
            tl.trainer_level_max_sr               AS max_sr,
            tl.trainer_level_pokeslots            AS pokeslots,
            tl.trainer_level_proficiency_bonus    AS prof
       FROM ${TPI} pi
       LEFT JOIN ${TTL} tl ON tl.trainer_level = pi.personaje_pending_improvement_lvl
      WHERE pi.personaje_pending_improvement_personaje_id = $1
        AND pi.personaje_pending_improvement_applied = false
      ORDER BY pi.personaje_pending_improvement_lvl`,
    [id_personaje]
  )
  if (!rows.length) return []

  // Nivel anterior de cada pendiente, para poder decir "de X a Y" en Control
  // Upgrade y Pokeslot. El del primero sale de la fila anterior del catálogo.
  const { rows: niveles } = await query(
    `SELECT trainer_level, trainer_level_max_sr, trainer_level_pokeslots FROM ${TTL} ORDER BY trainer_level`)
  const porNivel = new Map(niveles.map(n => [Number(n.trainer_level), n]))

  const { rows: stats } = await query(`SELECT * FROM ${TS} WHERE id_personaje = $1`, [id_personaje])
  const st = stats[0] || {}

  // Ruta ya elegida, si la hay: la necesita "Trainer Path Feature" para saber
  // qué rasgo anunciar. Los niveles de trainer_levels y los de path_bonus
  // coinciden (2, 5, 9 y 15), así que el nivel pendiente sirve de índice.
  const { rows: pr } = await query(
    `SELECT p.personaje_path, pa.path_name
       FROM ${T} p LEFT JOIN ${TPATHS} pa ON pa.path_id = p.personaje_path
      WHERE p.id_personaje = $1`, [id_personaje])
  const pathId   = pr[0]?.personaje_path ?? null
  const pathName = pr[0]?.path_name ?? null

  // Dado de golpe: cada nivel se tira y se suma al HP, igual que los Pokémon
  const { rows: hd } = await query(
    `SELECT personaje_hit_dice FROM ${T} WHERE id_personaje = $1`, [id_personaje])
  const hitDice = hd[0]?.personaje_hit_dice ?? null

  // Qué Pokémon ganarían STAB, para la ventana del rasgo stab_bonus
  const stabPreview = await previewStab(id_personaje)
  const bondPreview = await previewBond(id_personaje)

  let bonosPorNivel = new Map()
  let rasgoPorNivel = new Map()
  if (pathId != null) {
    const { rows: bs } = await query(
      `SELECT * FROM ${TPB} WHERE path_id = $1 ORDER BY path_bonus_level, path_bonus_id`, [pathId])
    for (const b of bs) {
      const n = Number(b.path_bonus_level)
      if (!bonosPorNivel.has(n)) bonosPorNivel.set(n, [])
      bonosPorNivel.get(n).push(b)
    }
    const { rows: pa } = await query(`SELECT * FROM ${TPATHS} WHERE path_id = $1`, [pathId])
    for (const n of [2, 5, 9, 15]) {
      rasgoPorNivel.set(n, {
        nombre: pa[0]?.[`path_level_${n}_feature_name`] ?? null,
        descripcion: pa[0]?.[`path_level_${n}_description`] ?? null,
      })
    }
  }

  return rows.map(r => {
    const previo = porNivel.get(Number(r.lvl) - 1)
    const n = Number(r.lvl)
    return {
      ...r,
      features_lista: splitFeatures(r.features),
      max_sr_previo:    previo ? Number(previo.trainer_level_max_sr) : null,
      pokeslots_previo: previo ? Number(previo.trainer_level_pokeslots) : null,
      // Salvaciones en las que AÚN NO es proficiente: son las que ofrece
      // Trainer's Resolve. Si ya las tiene todas, la lista llega vacía.
      saving_disponibles: STAT_KEYS.filter(k => !st[`personaje_stats_${k}_prof`]),
      path_id: pathId,
      path_name: pathName,
      path_rasgo: rasgoPorNivel.get(n) ?? null,
      // Cada bono con su clasificación, para que la ventana sepa si tiene que
      // pedir una elección, anunciar una skill fija, o solo mostrarlo
      path_bonos: (bonosPorNivel.get(n) ?? []).map(b => ({ ...b, regla: clasificarBono(b) })),
      stab_preview: stabPreview,
      bond_preview: bondPreview,
      hit_dice: hitDice,
      hit_dice_max: hitDiceMax(hitDice),
    }
  })
}

// Clasifica un bono del catálogo path_bonus para saber qué hay que hacer con él.
//
//   'elegir'  → el jugador escoge N skills (path_bonus_key = 'chosen_skill')
//   'fija'    → la skill viene en la llave y se otorga sin preguntar
//   null      → narrativa: se muestra, no se persiste ni se aplica
//
// Todo lo que no sea skill_proficiency / skill_expertise es narrativa. Es
// deliberado: son bonos de recurso o de usos que el DM lleva en la mesa.
const clasificarBono = (b) => {
  const tipo   = norm(b.path_bonus_type)
  const llave  = norm(b.path_bonus_key)
  const target = norm(b.path_bonus_target)
  // Especialización extra: se reconoce por la LLAVE. En el catálogo el tipo es
  // 'extra_specialization', pero la llave es lo que la identifica sin depender
  // de que ese tipo se escriba siempre igual.
  if (llave === 'specialization') {
    return { modo: 'spec_extra', cuantas: Math.max(1, Math.floor(Number(b.path_bonus_value) || 1)), target }
  }

  // Recurso del entrenador: puntos gastables. path_bonus_uses_formula nombra la
  // COLUMNA de personaje de la que sale el máximo (personaje_level, prof...).
  // Si viene vacía, la fórmula está en prosa y queda fuera por ahora.
  if (tipo === 'resource' && target === 'trainer') {
    const col = (b.path_bonus_uses_formula || '').trim()
    if (!col) return null
    return { modo: 'resource', nombre: (b.path_bonus_resource_name || '').trim() || llave, columna: col, target }
  }

  // Vínculo: se reconoce por el TARGET, no por el tipo. En el catálogo la fila
  // de Commander es type 'resource', así que mirar solo el tipo la dejaría como
  // narrativa.
  if (target === 'positive_bond_pokemon') return { modo: 'bond', valor: '1', target: 'all_pokemon' }
  // STAB: no pide elección. Se persiste una marca y el bono real se calcula al
  // leer, porque depende de las especializaciones, que llegan en niveles 7 y 18.
  // Tope de SR: suma permanente al máximo que da trainer_levels
  if (tipo === 'max_sr_bonus' && target === 'trainer') {
    return { modo: 'max_sr', valor: String(Math.max(1, Math.abs(parseInt(b.path_bonus_value, 10) || 1))), target }
  }
  if (tipo === 'stab_bonus') return { modo: 'stab', valor: '1', target: 'all_pokemon' }
  if (tipo !== 'skill_proficiency' && tipo !== 'skill_expertise') return null
  const valor = tipo === 'skill_expertise' ? 'expert' : 'prof'
  if (llave === 'chosen_skill') {
    // Cuántas se eligen: en los 'chosen_skill' el valor es la cantidad
    const cuantas = Math.max(1, Math.floor(Number(b.path_bonus_value) || 1))
    return { modo: 'elegir', valor, cuantas, target }
  }
  if (!llave) return null
  return { modo: 'fija', valor, llave, target }
}

// Lee de personaje la columna que nombra el bono de recurso. Devuelve null si
// esa columna no existe, para no interpolar en el SQL algo que no se validó.
const _columnasPersonaje = new Set()
const valorDeColumna = async (id_personaje, columna, run = query) => {
  if (!_columnasPersonaje.size) {
    const { rows } = await run(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = 'personaje'`, [SCHEMA])
    for (const r of rows) _columnasPersonaje.add(r.column_name)
  }
  if (!_columnasPersonaje.has(columna)) return null
  const { rows } = await run(`SELECT "${columna}" AS v FROM ${T} WHERE id_personaje = $1`, [id_personaje])
  return Math.max(0, Number(rows[0]?.v) || 0)
}

// Los bonos de un nivel que exigen elección del jugador
const bonosAElegir = (bonos) => (bonos || [])
  .map(b => ({ b, c: clasificarBono(b) }))
  .filter(x => x.c?.modo === 'elegir')

// 'animal_handling' → 'Animal Handling'. Las llaves del catálogo vienen en
// snake_case y la tabla skills las guarda con espacios y mayúsculas.
const skillPorLlave = async (llave, run = query) => {
  const { rows } = await run(
    `SELECT skill_name FROM "${SCHEMA}"."skills"
      WHERE lower(replace(skill_name, ' ', '_')) = lower($1) LIMIT 1`, [llave])
  return rows[0]?.skill_name ?? null
}

// Copia a personaje_path_bonus los bonos que la ruta otorga en ese nivel.
// Se borran antes los del mismo nivel: confirmar dos veces no debe duplicarlos,
// y si el máster rehiciera el pendiente los deja como estaban.
const otorgarBonosDePath = async (client, id_personaje, path_id, nivel, elegidas = {}) => {
  const { rows } = await client.query(
    `SELECT * FROM ${TPB} WHERE path_id = $1 AND path_bonus_level = $2 ORDER BY path_bonus_id`,
    [path_id, nivel])

  // Se borran los del mismo nivel antes de insertar: confirmar dos veces no
  // debe duplicarlos.
  await client.query(
    `DELETE FROM ${TPPB}
      WHERE personaje_path_bonus_personaje_id = $1 AND personaje_path_bonus_level = $2`,
    [id_personaje, nivel])

  const run = (t, pr) => client.query(t, pr)
  let n = 0
  const insertar = async (llave, valor, target) => {
    await run(
      `INSERT INTO ${TPPB} (
         personaje_path_bonus_personaje_id, personaje_path_bonus_type,
         personaje_path_bonus_llave, personaje_path_bonus_value,
         personaje_path_bonus_target, personaje_path_bonus_level
       ) VALUES ($1, 'skill', $2, $3, $4, $5)`,
      [id_personaje, llave, valor, target, nivel])
    n++
  }

  for (const b of rows) {
    const c = clasificarBono(b)
    if (!c) continue                       // narrativa: no se persiste
    if (c.modo === 'resource') {
      // value guarda el NOMBRE de la columna y target los puntos que quedan.
      // El máximo no se guarda: se lee de esa columna, así crece solo cuando
      // sube el nivel o la proficiencia sin dejar un número obsoleto.
      // La columna viene del catálogo, no de un formulario, pero igual se
      // valida contra el esquema: es lo único que se interpola en el SQL.
      const maximo = await valorDeColumna(id_personaje, c.columna, run)
      if (maximo == null) continue   // columna desconocida: se ignora el bono
      await run(
        `INSERT INTO ${TPPB} (
           personaje_path_bonus_personaje_id, personaje_path_bonus_type,
           personaje_path_bonus_llave, personaje_path_bonus_value,
           personaje_path_bonus_target, personaje_path_bonus_level
         ) VALUES ($1, 'resource', $2, $3, $4, $5)`,
        [id_personaje, c.nombre, c.columna, String(maximo), nivel])
      n++
      continue
    }
    if (c.modo === 'spec_extra') continue   // se persiste aparte, con la elección
    if (c.modo === 'max_sr') {
      // Se persiste como marca y además se suma ya al SR actual, para que el
      // punto se note sin esperar a la siguiente subida de nivel.
      await run(
        `INSERT INTO ${TPPB} (
           personaje_path_bonus_personaje_id, personaje_path_bonus_type,
           personaje_path_bonus_llave, personaje_path_bonus_value,
           personaje_path_bonus_target, personaje_path_bonus_level
         ) VALUES ($1, 'max_sr_bonus', 'max_sr', $2, 'trainer', $3)`,
        [id_personaje, c.valor, nivel])
      await run(
        `UPDATE ${T} SET personaje_sr = COALESCE(personaje_sr, 0) + $2 WHERE id_personaje = $1`,
        [id_personaje, Number(c.valor) || 1])
      n++
      continue
    }
    if (c.modo === 'bond') {
      // Igual que el de STAB: una marca. A quién alcanza y cuánto se resuelve
      // en lib/bond.js al leer, porque depende del starter y del vínculo actual.
      await run(
        `INSERT INTO ${TPPB} (
           personaje_path_bonus_personaje_id, personaje_path_bonus_type,
           personaje_path_bonus_llave, personaje_path_bonus_value,
           personaje_path_bonus_target, personaje_path_bonus_level
         ) VALUES ($1, 'bond_bonus', 'bond_bonus', '1', 'all_pokemon', $2)`,
        [id_personaje, nivel])
      // Suma ya los puntos a los Pokémon que cumplen y deja el nivel al día
      await aplicarBonoBond(id_personaje, run)
      n++
      continue
    }
    if (c.modo === 'stab') {
      // Fila fija: la llave y el valor no varían, lo que cambia es a cuántos
      // Pokémon alcanza, y eso se resuelve en lib/stab.js al leer.
      await run(
        `INSERT INTO ${TPPB} (
           personaje_path_bonus_personaje_id, personaje_path_bonus_type,
           personaje_path_bonus_llave, personaje_path_bonus_value,
           personaje_path_bonus_target, personaje_path_bonus_level
         ) VALUES ($1, 'stab_bonus', 'stab_bonus', '1', 'all_pokemon', $2)`,
        [id_personaje, nivel])
      n++
      continue
    }
    if (c.modo === 'fija') {
      // La llave trae la skill en snake_case; se guarda con su nombre real
      const nombre = await skillPorLlave(c.llave, run)
      if (nombre) await insertar(nombre, c.valor, c.target)
      continue
    }
    // 'elegir': una fila por cada skill que escogió el jugador
    for (const nombre of (elegidas[b.path_bonus_id] || [])) {
      await insertar(nombre, c.valor, c.target)
    }
  }
  return n
}

// Especializaciones que el personaje todavía no tiene
const specsDisponibles = async (id_personaje) => {
  const { rows } = await query(
    `SELECT s.* FROM ${TSPEC} s
      WHERE s.specialization_id NOT IN (
        SELECT DISTINCT id_specializations FROM ${TPSB} WHERE id_personaje = $1)
      ORDER BY s.specialization_name`,
    [id_personaje]
  )
  return rows
}

const pendienteById = async (id_personaje, id) => {
  const { rows } = await query(
    `SELECT personaje_pending_improvement_id AS id,
            personaje_pending_improvement_lvl AS lvl,
            personaje_pending_improvement_features AS features
       FROM ${TPI}
      WHERE personaje_pending_improvement_id = $1
        AND personaje_pending_improvement_personaje_id = $2
        AND personaje_pending_improvement_applied = false`,
    [id, id_personaje]
  )
  return rows[0] || null
}

/**
 * Confirma un nivel pendiente aplicando lo que el jugador eligió.
 * @param choices { asi: {dex,str,...}, specialization_id, saving }
 */
const confirm = async (id_personaje, pendingId, choices = {}) => {
  const pend = await pendienteById(id_personaje, pendingId)
  if (!pend) return { error: 'notfound' }

  // No se puede saltar un nivel: siempre se confirma el más bajo pendiente,
  // porque las elecciones de uno pueden condicionar las del siguiente.
  const { rows: menor } = await query(
    `SELECT MIN(personaje_pending_improvement_lvl) AS lvl FROM ${TPI}
      WHERE personaje_pending_improvement_personaje_id = $1
        AND personaje_pending_improvement_applied = false`,
    [id_personaje]
  )
  if (Number(menor[0]?.lvl) !== Number(pend.lvl)) return { error: 'orden', lvl: Number(menor[0]?.lvl) }

  const necesitaAsi  = tiene(pend.features, 'Ability Score Improvement')
  const necesitaSpec = tiene(pend.features, 'Specialization')
  const necesitaSav  = tiene(pend.features, "Trainer's Resolve")
  const eligePath    = tiene(pend.features, 'Trainer Path')
  const rasgoDePath  = tiene(pend.features, 'Trainer Path Feature')

  // ── Validaciones antes de tocar nada ──
  // Dado de golpe: entero entre 1 y el dado del personaje. Se pide en TODOS los
  // niveles, no solo en los que traen features.
  const { rows: hd } = await query(`SELECT personaje_hit_dice FROM ${T} WHERE id_personaje = $1`, [id_personaje])
  const dadoMax = hitDiceMax(hd[0]?.personaje_hit_dice)
  const roll = Math.floor(Number(choices.hp_roll))
  if (!Number.isFinite(roll) || roll < 1 || roll > dadoMax) {
    return { error: 'hproll', max: dadoMax }
  }

  let asi = null
  if (necesitaAsi) {
    asi = {}
    let suma = 0
    for (const k of STAT_KEYS) {
      const v = Math.max(0, Math.floor(Number(choices.asi?.[k]) || 0))
      asi[k] = v; suma += v
    }
    if (suma !== ASI_PUNTOS) return { error: 'asi', puntos: ASI_PUNTOS }
  }

  let spec = null
  if (necesitaSpec) {
    const id_spec = Number(choices.specialization_id)
    if (!id_spec) return { error: 'specialization' }
    const disponibles = await specsDisponibles(id_personaje)
    spec = disponibles.find(s => Number(s.specialization_id) === id_spec)
    if (!spec) return { error: 'specialization' }
  }

  // La ruta: se elige en el nivel 2 y a partir de ahí ya está guardada.
  // El orden estricto de confirmación garantiza que al llegar al 5 ya exista.
  let path_id = null
  if (eligePath) {
    path_id = Number(choices.path_id)
    if (!path_id) return { error: 'path' }
    const { rows } = await query(`SELECT path_id FROM ${TPATHS} WHERE path_id = $1`, [path_id])
    if (!rows.length) return { error: 'path' }
  } else if (rasgoDePath) {
    const { rows } = await query(`SELECT personaje_path FROM ${T} WHERE id_personaje = $1`, [id_personaje])
    path_id = rows[0]?.personaje_path ?? null
    if (path_id == null) return { error: 'sinpath' }
  }

  // Skills elegidas para los bonos 'chosen_skill' de la ruta: { path_bonus_id: [nombres] }
  let elegidas = {}
  if (path_id != null && (eligePath || rasgoDePath)) {
    const { rows: bs } = await query(
      `SELECT * FROM ${TPB} WHERE path_id = $1 AND path_bonus_level = $2`, [path_id, Number(pend.lvl)])
    const pendientesDeElegir = bonosAElegir(bs)
    if (pendientesDeElegir.length) {
      const { rows: cat } = await query(`SELECT skill_name FROM "${SCHEMA}"."skills"`)
      const validas = new Map(cat.map(r => [norm(r.skill_name), r.skill_name]))
      for (const { b, c } of pendientesDeElegir) {
        const pedidas = choices.path_skills?.[b.path_bonus_id] ?? choices.path_skills?.[String(b.path_bonus_id)] ?? []
        // Sin duplicados: elegir dos veces la misma no otorgaría dos proficiencias
        const unicas = [...new Set((Array.isArray(pedidas) ? pedidas : []).map(x => norm(x)).filter(Boolean))]
        if (unicas.length !== c.cuantas) return { error: 'pathskills', cuantas: c.cuantas, bonus_id: b.path_bonus_id }
        if (unicas.some(x => !validas.has(x))) return { error: 'pathskills', cuantas: c.cuantas, bonus_id: b.path_bonus_id }
        elegidas[b.path_bonus_id] = unicas.map(x => validas.get(x))
      }
    }
  }

  // Especialización extra que da un bono de ruta. Va en su propia clave para no
  // chocar con la feature 'Specialization' del nivel, que puede coincidir.
  let specPath = null
  if (path_id != null && (eligePath || rasgoDePath)) {
    const { rows: bs } = await query(
      `SELECT * FROM ${TPB} WHERE path_id = $1 AND path_bonus_level = $2`, [path_id, Number(pend.lvl)])
    if (bs.some(b => clasificarBono(b)?.modo === 'spec_extra')) {
      const idsp = Number(choices.path_specialization_id)
      if (!idsp) return { error: 'pathspec' }
      const disp = await specsDisponibles(id_personaje)
      specPath = disp.find(x => Number(x.specialization_id) === idsp)
      // Si ya la tiene no otorgaría nada y se perdería la mejora
      if (!specPath) return { error: 'pathspec' }
      if (spec && Number(spec.specialization_id) === idsp) return { error: 'pathspec' }
    }
  }

  let saving = null
  if (necesitaSav) {
    saving = norm(choices.saving)
    if (!STAT_KEYS.includes(saving)) return { error: 'saving' }
    const { rows: st } = await query(`SELECT * FROM ${TS} WHERE id_personaje = $1`, [id_personaje])
    // Elegir una que ya tiene no otorgaría nada y desperdiciaría la mejora
    if (st[0]?.[`personaje_stats_${saving}_prof`]) return { error: 'saving' }
  }

  return transaction(async (client) => {
    // El máximo y el actual suben lo mismo: la vida ganada al subir de nivel se
    // otorga de inmediato, igual que en los Pokémon.
    await client.query(
      `UPDATE ${T} SET personaje_hp = COALESCE(personaje_hp, 0) + $2,
                       personaje_current_hp = COALESCE(personaje_current_hp, 0) + $2
        WHERE id_personaje = $1`, [id_personaje, roll])

    if (asi) {
      const { rows: st } = await client.query(`SELECT * FROM ${TS} WHERE id_personaje = $1`, [id_personaje])
      const cur = st[0] || {}
      const sets = [], params = []
      for (const k of STAT_KEYS) {
        if (!asi[k]) continue
        const nuevo = Math.min((Number(cur[`personaje_${k}`]) || 0) + asi[k], STAT_CAP)
        params.push(nuevo); sets.push(`personaje_${k} = $${params.length}`)
      }
      if (sets.length) {
        params.push(id_personaje)
        await client.query(`UPDATE ${TS} SET ${sets.join(', ')} WHERE id_personaje = $${params.length}`, params)
      }
    }

    // Las dos vías -la feature del nivel y el bono de ruta- generan las mismas
    // filas, así que comparten el mismo bloque.
    for (const sp of [spec, specPath].filter(Boolean)) {
      const bonos = []
      if (sp.specialization_ability_score_increase) {
        bonos.push({ type: 'stat', llave: sp.specialization_ability_score_increase,
                     value: String(sp.specialization_ability_score_increase_value ?? 1) })
      }
      if (sp.specialization_skill_proficiency) {
        bonos.push({ type: 'skill', llave: sp.specialization_skill_proficiency, value: 'exp' })
      }
      for (const b of bonos) {
        await client.query(
          `INSERT INTO ${TPSB}
             (id_personaje, id_specializations, tipo_personaje_specializations_bonus,
              llave_personaje_specializations_bonus, valor_personaje_specializations_bonus)
           VALUES ($1, $2, $3, $4, $5)`,
          [id_personaje, sp.specialization_id, b.type, b.llave, b.value])
      }
    }

    if (saving) {
      await client.query(
        `UPDATE ${TS} SET personaje_stats_${saving}_prof = true WHERE id_personaje = $1`,
        [id_personaje])
    }

    // Elegir la ruta guarda la ruta Y otorga el rasgo que da en ese mismo nivel:
    // el nivel 2 aparece tanto en trainer_levels como en path_bonus.
    if (eligePath) {
      await client.query(`UPDATE ${T} SET personaje_path = $2 WHERE id_personaje = $1`,
        [id_personaje, path_id])
    }
    let bonos_otorgados = 0
    if (path_id != null && (eligePath || rasgoDePath)) {
      bonos_otorgados = await otorgarBonosDePath(client, id_personaje, path_id, Number(pend.lvl), elegidas)
    }

    await client.query(
      `UPDATE ${TPI} SET personaje_pending_improvement_applied = true
        WHERE personaje_pending_improvement_id = $1`, [pend.id])

    // El nivel del entrenador puede haber movido los puntos: se revalida el
    // vínculo de todos sus Pokémon contra la tabla bonds.
    await sincronizarBondSeguro({ id_personaje }, (t, p) => client.query(t, p))

    return { ok: true, lvl: Number(pend.lvl), hp_roll: roll, asi, saving,
             specialization: spec?.specialization_name ?? null,
             path_specialization: specPath?.specialization_name ?? null, path_id, bonos_otorgados }
  })
}

module.exports = { listPending, specsDisponibles, confirm }
