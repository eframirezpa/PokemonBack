const test = require('node:test')
const assert = require('node:assert')
const {
  xpAlDerrotar, xpAlAtrapar, xpPorMotivo, agruparIntervenciones,
  repartoIgual, validarRepartoDm, validarAsignacion,
} = require('../src/lib/xp')

test('fórmula: derrotar 200 x nivel x SR, atrapar 1/5', () => {
  assert.strictEqual(xpAlDerrotar(20, '13'), 52000)
  assert.strictEqual(xpAlDerrotar(5, '1/4'), 250)
  assert.strictEqual(xpAlAtrapar(5, '1/4'), 50)
  assert.strictEqual(xpPorMotivo('captura', 20, '13'), 10400)
  assert.strictEqual(xpPorMotivo('derrota', 20, '13'), 52000)
  assert.strictEqual(xpAlDerrotar(5, 'Varies'), null)
})

test('intervenciones agrupadas por entrenador, sin Pokémon repetidos', () => {
  const g = agruparIntervenciones([
    { id_personaje: 4, id_personaje_pokemon: 11, intervencion_tipo: 'ataque' },
    { id_personaje: 7, id_personaje_pokemon: null, intervencion_tipo: 'pokebola' },
    { id_personaje: 4, id_personaje_pokemon: 11, intervencion_tipo: 'ataque' },
    { id_personaje: 4, id_personaje_pokemon: 12, intervencion_tipo: 'ataque' },
    { id_personaje: 4, id_personaje_pokemon: null, intervencion_tipo: 'ataque' },
  ])
  assert.deepStrictEqual(g, [
    { id_personaje: 4, ataques: 4, pokebolas: 0, pokemones: [11, 12] },
    { id_personaje: 7, ataques: 0, pokebolas: 1, pokemones: [] },
  ])
})

test('reparto igual suma exacto el total', () => {
  assert.deepStrictEqual(repartoIgual(52000, 2), [26000, 26000])
  assert.deepStrictEqual(repartoIgual(10, 3), [4, 3, 3])
  assert.deepStrictEqual(repartoIgual(10, 0), [])
})

test('reparto del DM: sin repetidos ni pasarse del total', () => {
  assert.deepStrictEqual(validarRepartoDm([{ id_personaje: 4, xp: 100 }, { id_personaje: 7, xp: 50 }], 150),
    { ok: true, reparto: [{ id_personaje: 4, xp: 100 }, { id_personaje: 7, xp: 50 }] })
  assert.strictEqual(validarRepartoDm([{ id_personaje: 4, xp: 200 }], 150).error, 'excede')
  assert.strictEqual(validarRepartoDm([{ id_personaje: 4, xp: 10 }, { id_personaje: 4, xp: 10 }], 150).error, 'repetido')
  assert.strictEqual(validarRepartoDm([{ id_personaje: 4, xp: -1 }], 150).error, 'cantidad')
  assert.strictEqual(validarRepartoDm([], 150).error, 'vacio')
})

test('asignación del entrenador: solo sus Pokémon y exactamente su parte', () => {
  assert.deepStrictEqual(validarAsignacion([{ id_personaje_pokemon: 11, xp: 60 }, { id_personaje_pokemon: 12, xp: 40 }], 100, [11, 12]),
    { ok: true, asignacion: [{ id_personaje_pokemon: 11, xp: 60 }, { id_personaje_pokemon: 12, xp: 40 }] })
  assert.strictEqual(validarAsignacion([{ id_personaje_pokemon: 99, xp: 100 }], 100, [11]).error, 'ajeno')
  assert.strictEqual(validarAsignacion([{ id_personaje_pokemon: 11, xp: 90 }], 100, [11]).error, 'suma')
  // Un Pokémon con 0 se descarta (no hay nada que sumarle)
  assert.deepStrictEqual(validarAsignacion([{ id_personaje_pokemon: 11, xp: 100 }, { id_personaje_pokemon: 12, xp: 0 }], 100, [11, 12]),
    { ok: true, asignacion: [{ id_personaje_pokemon: 11, xp: 100 }] })
})

const { margenXp, partirXp } = require('../src/lib/xp')
const umbral = new Map([[1, 0], [2, 200], [3, 800], [4, 2000], [5, 6000], [19, 382000], [20, 450000]])

test('margen: sube como mucho un nivel', () => {
  // Nivel 3 con 800: el tope es 1 menos que el umbral del 5
  assert.deepStrictEqual(margenXp({ nivel: 3, experiencia: 800, umbral }), { max: 5199 })
  // En el 19 puede llegar exacto al 20
  assert.deepStrictEqual(margenXp({ nivel: 19, experiencia: 400000, umbral }), { max: 50000 })
  assert.deepStrictEqual(margenXp({ nivel: 20, experiencia: 450000, umbral }), { error: 'max' })
})

test('partir: lo que no cabe se guarda; en el 20 se pierde', () => {
  assert.deepStrictEqual(partirXp(26000, { max: 5199 }), { aplicar: 5199, guardar: 20801, perder: 0 })
  assert.deepStrictEqual(partirXp(100, { max: 5199 }), { aplicar: 100, guardar: 0, perder: 0 })
  assert.deepStrictEqual(partirXp(500, { error: 'nomargin' }), { aplicar: 0, guardar: 500, perder: 0 })
  assert.deepStrictEqual(partirXp(500, { error: 'max' }), { aplicar: 0, guardar: 0, perder: 500 })
})
