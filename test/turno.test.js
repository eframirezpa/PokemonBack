const test = require('node:test')
const assert = require('node:assert')
const { pasoDeTurno } = require('../src/lib/turno')

test('adelante: dar la vuelta suma ronda', () => {
  assert.deepStrictEqual(pasoDeTurno({ turno: 1, ronda: 1, total: 3, direccion: 'siguiente' }), { turno: 2, ronda: 1 })
  assert.deepStrictEqual(pasoDeTurno({ turno: 2, ronda: 1, total: 3, direccion: 'siguiente' }), { turno: 0, ronda: 2 })
})

test('atrás desde el primer turno vuelve a la ronda anterior', () => {
  assert.deepStrictEqual(pasoDeTurno({ turno: 0, ronda: 2, total: 3, direccion: 'anterior' }), { turno: 2, ronda: 1 })
  assert.deepStrictEqual(pasoDeTurno({ turno: 2, ronda: 2, total: 3, direccion: 'anterior' }), { turno: 1, ronda: 2 })
})

test('atrás en el primer turno de la ronda 1 no se mueve', () => {
  assert.deepStrictEqual(pasoDeTurno({ turno: 0, ronda: 1, total: 3, direccion: 'anterior' }), { turno: 0, ronda: 1 })
})

test('adelante y atrás se deshacen', () => {
  let e = { turno: 0, ronda: 1 }
  for (let i = 0; i < 7; i++) e = pasoDeTurno({ ...e, total: 3, direccion: 'siguiente' })
  for (let i = 0; i < 7; i++) e = pasoDeTurno({ ...e, total: 3, direccion: 'anterior' })
  assert.deepStrictEqual(e, { turno: 0, ronda: 1 })
})
