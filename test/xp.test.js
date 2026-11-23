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
