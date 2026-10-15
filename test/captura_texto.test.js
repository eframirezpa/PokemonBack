const test = require('node:test')
const assert = require('node:assert')
const { textoCaptura } = require('../src/services/captura.service')

const base = {
  nombre_personaje: 'Ash', bola: { nombre: 'Poke Ball' }, pokemon: 'Pikachu',
  d20: 12, bono: 3, total: 15, dc: 18, ventaja: false, automatica: false, oculto: false,
}

test('si lo atrapa, la línea lleva la DC', () => {
  const t = textoCaptura({ ...base, exito: true, total: 19 })
  assert.match(t.texto, /contra DC 18/)
  assert.strictEqual(t.texto_master, null)
})

test('si escapa, la mesa no ve la DC; el máster sí', () => {
  const t = textoCaptura({ ...base, exito: false })
  assert.doesNotMatch(t.texto, /DC/)
  assert.match(t.texto, /12 \+3 = 15\)/)
  assert.match(t.texto_master, /contra DC 18/)
})

test('oculto que escapa: ni nombre ni DC para la mesa', () => {
  const t = textoCaptura({ ...base, exito: false, oculto: true })
  assert.doesNotMatch(t.texto, /Pikachu|DC/)
  assert.match(t.texto_master, /Pikachu.*contra DC 18/)
})
