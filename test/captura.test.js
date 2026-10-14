const test = require('node:test')
const assert = require('node:assert')
const { srCaptura, claveBola, calcularDC } = require('../src/lib/captura')

const base = { nivel: 5, sr: '5', hpActual: 40, hpMax: 40, bola: 'Poké Ball', tipos: ['Fire'], tamanio: 'Medium', nivelEntrenador: 3 }

test('SR: entero tal cual, fracción y texto raro cuentan 1', () => {
  assert.strictEqual(srCaptura('13'), 13)
  assert.strictEqual(srCaptura('1/2'), 1)
  assert.strictEqual(srCaptura('1/4'), 1)
  assert.strictEqual(srCaptura('Varies'), 1)
  assert.strictEqual(srCaptura(null), 1)
})

test('clave de la pokébola sin tildes ni mayúsculas', () => {
  assert.strictEqual(claveBola('Poké Ball'), 'poke')
  assert.strictEqual(claveBola('Great Ball'), 'great')
  assert.strictEqual(claveBola(' Quick Ball '), 'quick')
})

test('ejemplo del Charmeleon: 10 + 5 + 5 con la vida llena', () => {
  assert.strictEqual(calcularDC(base).dc, 20)
})

test('media vida es estrictamente menos de la mitad', () => {
  assert.strictEqual(calcularDC({ ...base, hpActual: 20 }).dc, 20)
  assert.strictEqual(calcularDC({ ...base, hpActual: 19 }).dc, 15)
  assert.strictEqual(calcularDC({ ...base, hpActual: 4 }).dc, 15)
  assert.strictEqual(calcularDC({ ...base, hpActual: 3 }).dc, 10)
})

test('sin tope de nivel: el Pokémon puede superar al entrenador', () => {
  const r = calcularDC({ ...base, nivel: 20, nivelEntrenador: 2 })
  assert.strictEqual(r.dc, 35)
})

test('descuentos de pokébola', () => {
  assert.strictEqual(calcularDC({ ...base, bola: 'Great Ball' }).dc, 15)
  assert.strictEqual(calcularDC({ ...base, bola: 'Ultra Ball' }).dc, 10)
  assert.strictEqual(calcularDC({ ...base, bola: 'Quick Ball', primeraRonda: true }).dc, 5)
  assert.strictEqual(calcularDC({ ...base, bola: 'Quick Ball', primeraRonda: false }).dc, 20)
  assert.strictEqual(calcularDC({ ...base, bola: 'Net Ball' }).dc, 20)
  assert.strictEqual(calcularDC({ ...base, bola: 'Net Ball', tipos: ['Bug', null] }).dc, 10)
  assert.strictEqual(calcularDC({ ...base, bola: 'Nest Ball' }).dc, 15)
  assert.strictEqual(calcularDC({ ...base, bola: 'Heavy Ball', tamanio: 'Small' }).dc, 20)
  assert.strictEqual(calcularDC({ ...base, bola: 'Heavy Ball' }).dc, 10)
  assert.strictEqual(calcularDC({ ...base, bola: 'Level Ball' }).dc, 20)
  assert.strictEqual(calcularDC({ ...base, bola: 'Level Ball', nivelEntrenador: 6 }).dc, 15)
  assert.strictEqual(calcularDC({ ...base, bola: 'Dusk Ball', condicion: true }).dc, 10)
  assert.strictEqual(calcularDC({ ...base, bola: 'Dusk Ball' }).dc, 20)
  assert.strictEqual(calcularDC({ ...base, bola: 'Timer Ball', turnos: 4 }).dc, 16)
  assert.strictEqual(calcularDC({ ...base, bola: 'Timer Ball', turnos: 50 }).dc, 10)
  assert.strictEqual(calcularDC({ ...base, bola: 'Friend Ball', bonoBola: 3 }).dc, 17)
  assert.strictEqual(calcularDC({ ...base, bola: 'Calvicie' }).dc, 20)
})

test('Master Ball no tiene DC', () => {
  const r = calcularDC({ ...base, bola: 'Master Ball' })
  assert.strictEqual(r.automatica, true)
  assert.strictEqual(r.dc, null)
})

test('el desglose suma la DC', () => {
  const r = calcularDC({ ...base, hpActual: 3, bola: 'Great Ball' })
  assert.strictEqual(r.desglose.reduce((a, d) => a + d.valor, 0), r.dc)
  assert.strictEqual(r.dc, 5)
})
