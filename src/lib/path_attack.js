// Bonos de ataque que otorga la ruta del entrenador (path_bonus_type =
// 'attack_bonus').
//
// A diferencia del resto de bonos de ruta, estos NO se guardan en
// personaje_path_bonus: se leen del catálogo cada vez, filtrando por la ruta del
// personaje y por los niveles que ya alcanzó. Un valor guardado se quedaría
// viejo en cuanto sube de nivel y le entra el bono del siguiente rasgo.
//
// El TARGET decide a quién le toca:
//
//   'trainer'      → al entrenador
//   'all_pokemon'  → a todos sus Pokémon
//
// Los demás targets del catálogo -'pokemon', 'specialized_type_pokemon',
// 'hatched_pokemon'- dependen de condiciones que la aplicación no puede
// comprobar, así que se muestran como aviso y no suman. Sumarlos a ciegas daría
// un número que en mesa habría que corregir a mano, que es peor que no darlo.
const { query, SCHEMA } = require('../config/db')

// Solo estos dos se pueden resolver con certeza
const TARGETS = { trainer: ['trainer'], pokemon: ['all_pokemon'] }

// El valor viene como texto y con signo: '+1', '-1', '2'
const num = (v) => Number.parseInt(String(v ?? '').replace(/\s/g, ''), 10) || 0

/**
 * El bono de ataque que la ruta le da a quien se pida.
 *
 * @param destino 'trainer' o 'pokemon'
 * @returns { total, detalle: [{ nivel, nombre, valor }] }
 */
const ataqueDeRuta = async (id_personaje, destino, run = query) => {
  const targets = TARGETS[destino]
  if (!targets || id_personaje == null) return { total: 0, detalle: [] }

  const { rows } = await run(
    `SELECT pb.path_bonus_level AS nivel,
            pb.path_bonus_feature_name AS nombre,
            pb.path_bonus_value AS valor
       FROM "${SCHEMA}"."personaje" p
       JOIN "${SCHEMA}"."path_bonus" pb ON pb.path_id = p.personaje_path
      WHERE p.id_personaje = $1
        AND lower(pb.path_bonus_type) = 'attack_bonus'
        AND lower(pb.path_bonus_target) = ANY($2)
        AND pb.path_bonus_level <= COALESCE(p.personaje_level, 0)
      ORDER BY pb.path_bonus_level, pb.path_bonus_id`,
    [id_personaje, targets])

  const detalle = rows.map(r => ({ nivel: Number(r.nivel), nombre: r.nombre, valor: num(r.valor) }))
  return { total: detalle.reduce((s, d) => s + d.valor, 0), detalle }
}

module.exports = { ataqueDeRuta }
