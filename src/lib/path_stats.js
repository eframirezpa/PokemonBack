// Bonos de característica que otorga la ruta del entrenador.
//
// Se guardan en personaje_path_bonus con tipo 'stat':
//
//   llave  → la característica elegida (dex, str, con, int, wis, cha)
//   value  → cuánto suma
//   target → a quién: 'trainer' o 'all_pokemon'
//
// Solo esos dos targets. El catálogo tiene alguno más -'hatched_pokemon' en la
// ruta Pokémon Breeder- que depende de una condición que la aplicación no puede
// comprobar; esos no se persisten como 'stat' y quedan de aviso.
//
// El bono NO se hornea en pokemon_stats: se suma al leer, como el resto de
// valores derivados. Guardarlo obligaría a recorrer todos los Pokémon del
// entrenador al subir de nivel, y a acordarse de hacerlo con cada Pokémon nuevo.
const { query, SCHEMA } = require('../config/db')

const STAT_KEYS = ['dex', 'str', 'con', 'int', 'wis', 'cha']
const TARGETS = { trainer: 'trainer', pokemon: 'all_pokemon' }

/**
 * Lo que la ruta suma a cada característica.
 *
 * @param destino 'trainer' o 'pokemon'
 * @returns { dex: 0, str: 0, ... } — siempre con las seis llaves
 */
const statsDeRuta = async (id_personaje, destino, run = query) => {
  const vacio = Object.fromEntries(STAT_KEYS.map(k => [k, 0]))
  const target = TARGETS[destino]
  if (!target || id_personaje == null) return vacio

  const { rows } = await run(
    `SELECT lower(personaje_path_bonus_llave) AS llave,
            personaje_path_bonus_value AS valor
       FROM "${SCHEMA}"."personaje_path_bonus"
      WHERE personaje_path_bonus_personaje_id = $1
        AND lower(personaje_path_bonus_type) = 'stat'
        AND lower(personaje_path_bonus_target) = $2`, [id_personaje, target])

  const out = { ...vacio }
  for (const r of rows) {
    if (!STAT_KEYS.includes(r.llave)) continue
    out[r.llave] += Number.parseInt(String(r.valor ?? '').replace(/\s/g, ''), 10) || 0
  }
  return out
}

/**
 * Suma el bono a una fila de stats de Pokémon, sobre la columna _bonus.
 *
 * Se mete ahí a propósito: esa columna ya significa "lo que se suma a la base"
 * -es donde vive la naturaleza-, así que todo el que lea al Pokémon lo ve sin
 * cambiar nada, incluido el cálculo de vida y el de las habilidades.
 *
 * RESPETA EL TOPE. Una característica no pasa de 20, o de 22 si el Pokémon
 * llegó a nivel 20; y de 22 en la que haya elegido el feat Gifted, que sube su
 * tope antes de tiempo. El bono se recorta hasta donde quepa en vez de
 * descartarse entero: si faltan 2 para el tope y el bono es 3, entran 2.
 *
 * El tope se mide sobre el TOTAL, contando lo que ya suman los feats: quien lee
 * al Pokémon hace base + bonus + feats, así que si no se descontaran aquí el
 * resultado se pasaría del tope por mucho que este bono cupiera solo.
 *
 * @param efectos  lo que devuelve efectosDeFeats: stat_extra y stat_cap
 */
const aplicarAStatsPokemon = (stats, bonos, { nivel = 1, efectos = null } = {}) => {
  if (!stats) return stats
  const topeBase = (Number(nivel) || 1) >= 20 ? 22 : 20
  for (const k of STAT_KEYS) {
    if (!bonos[k]) continue
    const tope = Math.max(topeBase, efectos?.stat_cap?.[k] || 0)
    const yaSuma = (Number(stats[`pokemon_${k}`]) || 0)
      + (Number(stats[`pokemon_${k}_bonus`]) || 0)
      + (efectos?.stat_extra?.[k] || 0)
    const cabe = Math.max(0, tope - yaSuma)
    if (!cabe) continue
    stats[`pokemon_${k}_bonus`] = (Number(stats[`pokemon_${k}_bonus`]) || 0) + Math.min(bonos[k], cabe)
  }
  return stats
}

module.exports = { STAT_KEYS, statsDeRuta, aplicarAStatsPokemon }
