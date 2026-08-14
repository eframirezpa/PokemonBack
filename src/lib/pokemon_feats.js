const { SCHEMA } = require('../config/db')

// Efectos de los feats de un Pokémon que se resuelven AL LEER, no se guardan.
//
// Un valor guardado se queda viejo en cuanto el Pokémon evoluciona, sube de
// nivel o cambia de movimientos, y hay que acordarse de recalcularlo en cada
// uno de esos sitios. Calculándolo aquí, todo el que lea al Pokémon ve lo
// mismo y no hay nada que mantener sincronizado.
//
// Lo que SÍ se guarda es la ELECCIÓN del jugador —qué característica subió,
// qué terreno eligió— porque eso no se puede deducir. Vive en
// personaje_pokemon_feat_bonus y aquí solo se lee.

// Un bono cuenta si su feat está activo y el bono también. Los feats se pueden
// desactivar desde la ficha, y entonces sus efectos dejan de aplicar.
const activos = (feats = []) => {
  const out = []
  for (const f of feats) {
    if (f.is_available === false) continue
    for (const b of (f.bonos || [])) {
      if (b.is_available === false) continue
      // pf_id identifica la INSTANCIA del feat, no el feat del catálogo: un
      // feat repetible aparece varias veces con el mismo feat_id y hay que
      // poder distinguir los bonos de cada toma.
      // Se arrastra el feat entero, no solo su nombre: el panel deja abrir su
      // ficha desde el bono y así no hay que ir a buscarlo por separado.
      out.push({ ...b, pf_id: f.personaje_pokemon_feat_id, feat_id: f.feat_id, feat_name: f.feat_name, feat: f })
    }
  }
  return out
}

// Techo del catálogo (feats_bonus_limit de Extra Move): por muchas veces que se
// tome el feat, un Pokémon no puede saber más de seis movimientos. Se aplica
// aquí para que una toma de más —por un fallo o por datos viejos— no se traduzca
// en un tope imposible.
const MAX_MOVIMIENTOS = 6

const tipo  = b => String(b.type  || '').toLowerCase().trim()
const llave = b => String(b.llave || '').toLowerCase().trim()
const num   = v => Number.parseInt(v, 10) || 0

/**
 * Resuelve todos los efectos calculados de los feats de un Pokémon.
 *
 * @param feats  los feats con sus bonos, tal y como los devuelve findPokemonDetail
 * @returns {{
 *   ac_extra: number,          // regla 1 — se suma al AC al mostrarlo
 *   held_item_slots: number,   // regla 2 — objetos que puede llevar (base 1)
 *   known_moves_max: number,   // regla 3 — movimientos que puede saber (base 4)
 *   stat_extra: object,        // regla 4 — puntos por característica
 *   stat_cap: object,          // regla 4 — tope elevado de la característica elegida
 *   pp_extra: object,          // regla 7 — PP de más: { all: n, porMovimiento: {} }
 *   attack_bonos: array,       // regla 6 — { feat_name, valor, terreno }
 * }}
 */
const efectosDeFeats = (feats = []) => {
  const bonos = activos(feats)

  const r = {
    ac_extra: 0,
    held_item_slots: 1,   // el tope base es un objeto
    known_moves_max: 4,   // los cuatro movimientos de siempre
    stat_extra: {},
    stat_cap: {},
    pp_extra: { all: 0, porMovimiento: {} },
    attack_bonos: [],
  }

  for (const b of bonos) {
    switch (tipo(b)) {
      // ── Regla 1 ── AC Up: repetible y sin tope, así que se acumula
      case 'ac':
        r.ac_extra += num(b.value)
        break

      // ── Regla 2 ── Ambidextrous: un hueco más de objeto equipado
      case 'held_item':
        r.held_item_slots += num(b.value)
        break

      // ── Regla 3 ── Extra Move: un movimiento más, hasta seis en total
      case 'known_moves':
        r.known_moves_max += num(b.value)
        break

      // ── Regla 4 ── Gifted: la característica la eligió el jugador y quedó
      // guardada en la llave. El tope de ESA característica sube a 22, aunque
      // el Pokémon no haya llegado al nivel 20.
      case 'stat': {
        const k = llave(b)
        if (!k || k === 'any') break   // sin elección guardada no se puede aplicar
        r.stat_extra[k] = (r.stat_extra[k] || 0) + num(b.value)
        r.stat_cap[k] = Math.max(r.stat_cap[k] || 0, 22)
        break
      }

      // ── Regla 7 ── Tireless: +1 PP. La llave dice a qué movimiento; con
      // 'all_moves' va a todos, y por eso el nuevo movimiento que sustituya a
      // otro lo hereda solo, sin tocar nada.
      case 'pp': {
        const k = llave(b)
        if (k === 'all_moves' || k === 'all') r.pp_extra.all += num(b.value)
        else if (k) r.pp_extra.porMovimiento[k] = (r.pp_extra.porMovimiento[k] || 0) + num(b.value)
        break
      }

      // ── Regla 6 ── Terrain Adept: el bono solo aplica en el terreno elegido,
      // que no puede saber la aplicación. Se lista para que el jugador lo tenga
      // delante y lo aplique en mesa; de ahí el recordatorio en el panel.
      case 'attack':
        if (llave(b) === 'attack_roll') {
          r.attack_bonos.push({
            pf_id:     b.pf_id,
            feat_id:   b.feat_id,
            feat_name: b.feat_name,
            valor:     num(b.value),
            feat:      b.feat,     // para poder abrir su ficha desde el bono
            // El terreno se guarda como valor de un bono aparte de la misma toma
            terreno:   null,
          })
        }
        break

      default:
        break
    }
  }

  r.known_moves_max = Math.min(r.known_moves_max, MAX_MOVIMIENTOS)

  // El terreno viaja en su propio bono ('terrain') y se empareja por INSTANCIA.
  // Emparejarlo por feat_id era un error: Terrain Adept es repetible, así que
  // dos tomas comparten feat_id y la segunda pisaba el terreno de la primera.
  const terrenos = {}
  for (const b of bonos) {
    if (tipo(b) === 'terrain') terrenos[b.pf_id] = b.value
  }
  for (const a of r.attack_bonos) a.terreno = terrenos[a.pf_id] ?? null

  return r
}

/** PP de más que le corresponden a un movimiento concreto (regla 7) */
const ppExtraDe = (efectos, moveName) => {
  const porNombre = efectos.pp_extra.porMovimiento[String(moveName || '').toLowerCase().trim()] || 0
  return efectos.pp_extra.all + porNombre
}

/**
 * Los efectos de un Pokémon consultando sus feats.
 *
 * Atajo para quien solo tiene el id: hace la consulta y devuelve lo mismo que
 * efectosDeFeats. `run` puede ser query o el client de una transacción.
 */
const efectosDePokemon = async (run, id_personaje_pokemon) => {
  const { rows } = await run(
    `SELECT pf.personaje_pokemon_feat_id, pf.personaje_feat_is_available AS is_available,
            f.feat_id, f.feat_name,
            COALESCE((
              SELECT json_agg(json_build_object(
                'type',  b.personaje_pokemon_feat_bonus_type,
                'llave', b.personaje_pokemon_feat_bonus_llave,
                'value', b.personaje_pokemon_feat_bonus_value,
                'is_available', b.personaje_pokemon_feat_bonus_is_available))
              FROM "${SCHEMA}"."personaje_pokemon_feat_bonus" b
              WHERE b.personaje_pokemon_feat_bonus_personaje_pokemon_feat_id = pf.personaje_pokemon_feat_id
            ), '[]') AS bonos
       FROM "${SCHEMA}"."personaje_pokemon_feat" pf
       JOIN "${SCHEMA}"."feats" f ON f.feat_id = pf.feat_id
      WHERE pf.id_trainer_pokemon = $1`, [id_personaje_pokemon])
  return efectosDeFeats(rows)
}

/**
 * ¿Este feat ya no aportaría nada a este Pokémon?
 *
 * Un feat repetible con tope —Extra Move llega a 6 movimientos— deja de tener
 * sentido al alcanzarlo: tomarlo sería gastar la mejora del nivel a cambio de
 * nada. Devuelve el motivo, o null si sí aporta.
 *
 * @param featCatalogo  fila de feats con su feat_bonuses (o bonos con `limit`)
 */
const topeAlcanzado = (featCatalogo, efectos) => {
  for (const b of (featCatalogo?.feat_bonuses || [])) {
    if (String(b.type || '').toLowerCase().trim() !== 'known_moves') continue
    const tope = Number.parseInt(b.limit, 10)
    if (Number.isFinite(tope) && efectos.known_moves_max >= tope) {
      return `El Pokémon ya llega a ${tope} movimientos`
    }
  }
  return null
}

module.exports = { efectosDeFeats, ppExtraDe, efectosDePokemon, topeAlcanzado }
