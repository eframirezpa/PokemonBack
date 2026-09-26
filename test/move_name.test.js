const test = require('node:test')
const assert = require('node:assert/strict')
const { claveMove } = require('../src/lib/move_name.js')

test('claveMove une las grafías de la Pokédex y del catálogo', () => {
  assert.equal(claveMove('Double Edge'), claveMove('Double-Edge'))
  assert.equal(claveMove('Will O Wisp'), claveMove('Will-O-Wisp'))
  assert.equal(claveMove('U Turn'), claveMove('U-Turn'))
  assert.equal(claveMove('  X-Scissor '), 'xscissor')
  assert.equal(claveMove(null), '')
})
