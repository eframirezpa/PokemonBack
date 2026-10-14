const test = require('node:test')
const assert = require('node:assert/strict')
const { agruparSesiones, sesionAnterior, resumir } = require('../src/lib/sesiones.js')

const H = 60 * 60 * 1000
const base = Date.parse('2026-09-01T20:00:00Z')
const fila = (id, horas, tipo = null) => ({ id, time: new Date(base + horas * H).toISOString(), tipo, texto: `linea ${id}` })

// Dos sesiones: 1-3 el 1 de septiembre, 4-5 un mes después
const filas = [fila(1, 0, 'ataque'), fila(2, 1, 'captura'), fila(3, 3, 'item'), fila(4, 24 * 30, 'nivel'), fila(5, 24 * 30 + 2)]

test('agrupa por pausas de más de 6 horas', () => {
  assert.deepEqual(agruparSesiones(filas).map(s => s.map(f => f.id)), [[1, 2, 3], [4, 5]])
})

test('jugando ahora (menos de 6 h desde la última línea): la anterior es la penúltima', () => {
  const ahora = base + (24 * 30 + 3) * H
  assert.deepEqual(sesionAnterior(filas, ahora).map(f => f.id), [1, 2, 3])
})

test('entrando días después: la anterior es la última', () => {
  const ahora = base + (24 * 60) * H
  assert.deepEqual(sesionAnterior(filas, ahora).map(f => f.id), [4, 5])
})

test('primera sesión en curso: no hay anterior', () => {
  assert.equal(sesionAnterior([fila(1, 0)], base + H), null)
  assert.equal(sesionAnterior([], base), null)
})

test('resumen: conteos por tipo y solo los destacados listados', () => {
  const r = resumir(filas.slice(0, 3))
  assert.equal(r.id_inicio, 1)
  assert.deepEqual(r.conteos, { ataque: 1, captura: 1, item: 1 })
  assert.deepEqual(r.destacados.map(d => d.tipo), ['captura'])
})
