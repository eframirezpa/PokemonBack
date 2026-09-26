const test = require('node:test')
const assert = require('node:assert/strict')
const { parseCuracion } = require('../src/lib/item_curacion.js')

const med = (desc, type = 'medicine') => parseCuracion({ item_type: type, item_description: desc })

test('potion: dados con modificador y rango', () => {
  const r = med('A trainer may use an action to restore 2d4 + 2 HP to an adjacent Pokémon.')
  assert.deepEqual(r.dados, { n: 2, caras: 4, mod: 2 })
  assert.equal(r.min, 4); assert.equal(r.max, 10); assert.equal(r.revive, false)
})

test('hyper potion: 4d12 + 10', () => {
  const r = med('restore 4d12 + 10 HP to an adjacent Pokémon')
  assert.equal(r.min, 14); assert.equal(r.max, 58)
})

test('HP fijo, baya incluida', () => {
  assert.equal(med('When consumed, restores 30 HP.', 'berry').fijo, 30)
  assert.equal(med('When consumed, restores 7 HP. A trainer may use a bonus action').fijo, 7)
})

test('revive: pide un Pokémon debilitado', () => {
  assert.equal(med('restore 2d4 + 2 HP to a fainted Pokémon. Consumed on use.').revive, true)
})

test('Sacred Ash no es automático (revive a varios a la mitad)', () => {
  assert.equal(med('spend 5 minutes to revive up to six fainted Pokémon. Each restored to half their max HP.'), null)
})

test('efectos con espera, PP y otros tipos no cuentan', () => {
  assert.equal(med('10 minutes after consumption, the Pokémon regains 70 HP.'), null)
  assert.equal(med('restore 5 PP to a single move'), null)
  assert.equal(med('restores 2d4 + 2 HP', 'pokeball'), null)
})

const { parsePP } = require('../src/lib/item_curacion.js')
const pp = (desc, type = 'medicine') => parsePP({ item_type: type, item_description: desc })

test('PP: Ether a un movimiento, Elixir a todos, Leppa baya', () => {
  assert.deepEqual(pp('restore 5 PP to a single move of an adjacent Pokémon'), { cantidad: 5, todos: false })
  assert.deepEqual(pp('restore 10 PP to a single moves of an adjacent Pokémon'), { cantidad: 10, todos: false })
  assert.deepEqual(pp('restore 5 PP to all moves of an adjacent Pokémon'), { cantidad: 5, todos: true })
  assert.deepEqual(pp('it restores 10 PP to a move.', 'berry'), { cantidad: 10, todos: false })
})

test('PP Up (vitamina) y otros no cuentan', () => {
  assert.equal(pp('The max PP of one of this Pokémon\'s moves increases by 2.'), null)
  assert.equal(pp('restores 2d4 + 2 HP'), null)
})

const { parseEstado } = require('../src/lib/item_curacion.js')
const es = (desc, type = 'medicine') => parseEstado({ item_type: type, item_description: desc })

test('estados: item específico, varios nombres y bayas', () => {
  assert.deepEqual(es('cure an adjacent Pokémon of the Burned condition. Consumed on use.'), { estados: ['quemado'], modo: 'lista' })
  assert.deepEqual(es('cure an adjacent Pokémon of the Poisoned or Badly Poisoned conditions.'), { estados: ['envenenado'], modo: 'lista' })
  assert.deepEqual(es('When consumed, it cures paralysis. It can be consumed as a reaction to becoming paralyzed.', 'berry'), { estados: ['paralizado'], modo: 'lista' })
  assert.deepEqual(es('When consumed, it cures sleep.', 'berry'), { estados: ['dormido'], modo: 'lista' })
  assert.deepEqual(es('cure an adjacent Pokémon of the Frozen condition.'), { estados: ['congelado'], modo: 'lista' })
  assert.deepEqual(es('When consumed, it cures confusion.', 'berry'), { estados: ['confuso'], modo: 'lista' })
})

test('estados: todos y uno cualquiera', () => {
  assert.equal(es('cure an adjacent Pokémon of all status conditions, and grants immunity for one round.').modo, 'todos')
  assert.equal(es('When consumed, it cures any single status condition.', 'berry').modo, 'uno')
})

test('estados: Full Restore, Guard Spec y bayas de daño no cuentan', () => {
  assert.equal(es('10 minutes after consumption, the Pokémon regains 70 HP and is cured of all status conditions.'), null)
  assert.equal(es('For 1 minute, that Pokémon cannot be affected by new status conditions.'), null)
  assert.equal(es('Can be consumed as a reaction to taking poison-type damage.', 'berry'), null)
})
