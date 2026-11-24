const test = require('node:test')
const assert = require('node:assert')
const { sanearEstados, sanearMeta, metaTrasQuitar } = require('../src/lib/estados')

test('uno no volátil y uno volátil a la vez', () => {
  assert.strictEqual(sanearEstados(['quemado', 'confuso']), 'quemado,confuso')
  assert.strictEqual(sanearEstados('confuso,quemado,dormido,retroceso'), 'quemado,confuso')
  assert.strictEqual(sanearEstados(['envenenado_grave']), 'envenenado_grave')
  assert.strictEqual(sanearEstados(['x']), null)
  assert.strictEqual(sanearEstados([]), null)
})

test('meta: solo lo conocido de lo que tiene, y gracia de lo que no tiene', () => {
  assert.deepStrictEqual(
    sanearMeta({ dormido: { restantes: 3, otro: 1 }, congelado: { dc: 13 }, gracia: { quemado: 1, dormido: 1, x: 2 } }, 'dormido'),
    { dormido: { restantes: 3 }, gracia: { quemado: 1 } })
  assert.strictEqual(sanearMeta(null, null), null)
  assert.strictEqual(sanearMeta('basura', 'quemado'), null)
})

test('curar: pierde los datos y entra en gracia', () => {
  assert.deepStrictEqual(metaTrasQuitar({ congelado: { dc: 13 } }, ['congelado'], null), { gracia: { congelado: 1 } })
})
