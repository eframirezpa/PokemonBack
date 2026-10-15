const test = require('node:test')
const assert = require('node:assert')
const { numeroTm, tmsCompatibles, movimientosQueCuentan, debeOlvidar } = require('../src/lib/tm')

test('número del TM desde el item', () => {
  assert.strictEqual(numeroTm({ item_name_id: 'tm-251', item_name: 'TM 251 - Curse' }), 251)
  assert.strictEqual(numeroTm({ item_name_id: 'tm-007' }), 7)
  assert.strictEqual(numeroTm({ item_name: 'TM 001 - Work Up' }), 1)
  assert.strictEqual(numeroTm({ item_name_id: 'potion', item_name: 'Potion' }), null)
})

test('lista de TM compatibles de la especie', () => {
  const s = tmsCompatibles('1, 6, 9, 251')
  assert.ok(s.has(251) && s.has(1))
  assert.ok(!s.has(2))
  assert.strictEqual(tmsCompatibles(null).size, 0)
})

test('Struggle no cuenta para el tope de 4', () => {
  const tres = [{ move_name_id: 'struggle' }, { move_name_id: 'tackle' }, { move_name_id: 'growl' }, { move_name_id: 'vine-whip' }]
  assert.strictEqual(movimientosQueCuentan(tres).length, 3)
  assert.strictEqual(debeOlvidar(tres), false)
  assert.strictEqual(debeOlvidar([...tres, { move_name_id: 'leech-seed' }]), true)
})
