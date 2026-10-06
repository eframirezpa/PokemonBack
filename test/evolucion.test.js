const test = require('node:test')
const assert = require('node:assert/strict')
const { evaluarCondiciones, validarPuntos, capacidad } = require('../src/lib/evolucion.js')

const ctxBase = {
  nivel: 8, genero: 'Female', bondLevel: 2,
  moveClaves: new Set(['rollout', 'doubleedge']), moveTipos: new Set(['fairy', 'normal']),
  itemClaves: new Set(['dawnstone']), itemsCatalogoClaves: new Set(['dawnstone', 'firestone']),
}
const fila = (pares) => {
  const f = {}
  pares.forEach(([t, v], i) => { f[`evolution_condition_${i + 1}_type`] = t; f[`evolution_condition_${i + 1}_value`] = v })
  return f
}
const cumple = (pares, ctx = ctxBase) => evaluarCondiciones(fila(pares), ctx).map(c => c.cumple)

test('nivel', () => {
  assert.deepEqual(cumple([['level', '8']]), [true])
  assert.deepEqual(cumple([['level', '14']]), [false])
})

test('item: en la mochila, faltante, y fuera del catálogo (manual)', () => {
  assert.deepEqual(cumple([['level', '1'], ['item', 'Dawn Stone']]), [true, true])
  assert.deepEqual(cumple([['level', '1'], ['item', 'Fire Stone']]), [true, false])
  assert.deepEqual(cumple([['level', '1'], ['item', 'Scroll of Waters']]), [true, null])
})

test('bond, género, movimiento y tipo de movimiento', () => {
  assert.deepEqual(cumple([['loyalty', '2']]), [true])
  assert.deepEqual(cumple([['loyalty', '3']]), [false])
  assert.deepEqual(cumple([['gender', 'female']]), [true])
  assert.deepEqual(cumple([['gender', 'male']]), [false])
  assert.deepEqual(cumple([['move', 'rollout']]), [true])
  assert.deepEqual(cumple([['move', 'double-edge']]), [true])
  assert.deepEqual(cumple([['move', 'ancient-power']]), [false])
  assert.deepEqual(cumple([['move-type', 'fairy']]), [true])
})

test('hora y especiales quedan para el DM', () => {
  assert.deepEqual(cumple([['level', '1'], ['time', 'night'], ['special', 'under a full moon']]), [true, null, null])
})

test('puntos: reparto válido y topes', () => {
  const base = { str: 13, dex: 14, con: 11, int: 6, wis: 11, cha: 12 }
  // Ejemplo oficial Eevee → Espeon: 14 puntos
  assert.equal(validarPuntos(base, { dex: 4, con: 1, int: 2, wis: 4, cha: 3 }, 14).ok, true)
  assert.equal(validarPuntos(base, { dex: 5, con: 1, int: 2, wis: 3, cha: 3 }, 14).error, 'por_stat')
  assert.equal(validarPuntos(base, { dex: 4, wis: 4 }, 14).error, 'suma')
  assert.equal(validarPuntos({ ...base, dex: 18 }, { dex: 3 }, 3).error, 'tope')
  assert.equal(validarPuntos(base, { dex: -1 }, 0).error, 'entero')
})

test('puntos: si los topes no dejan gastarlos todos, basta con el máximo posible', () => {
  const casiTope = { str: 20, dex: 20, con: 20, int: 20, wis: 19, cha: 18 }
  assert.equal(capacidad(casiTope), 3)
  assert.equal(validarPuntos(casiTope, { wis: 1, cha: 2 }, 10).ok, true)
})

test('nivel 20: el tope sube a 22', () => {
  const base = { str: 10, dex: 18, con: 10, int: 10, wis: 10, cha: 10 }
  assert.equal(validarPuntos(base, { dex: 4 }, 4, 20).ok, true)
  assert.equal(validarPuntos(base, { dex: 4 }, 4, 19).error, 'tope')
})

test('un stat que ya pasa el tope no bloquea la evolución', () => {
  // Charmander nivel 20 con 22 de DEX: puede evolucionar repartiendo en otros
  const base = { str: 10, dex: 22, con: 10, int: 10, wis: 10, cha: 10 }
  assert.equal(validarPuntos(base, { str: 4, con: 2 }, 6, 20).ok, true)
  assert.equal(validarPuntos(base, { dex: 1, str: 4, con: 1 }, 6, 20).error, 'tope')
})
