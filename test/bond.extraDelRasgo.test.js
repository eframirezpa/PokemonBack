const { test } = require('node:test')
const assert = require('node:assert/strict')
const { extraDelRasgo } = require('../src/lib/bond')

// Regresión: extraDelRasgo debía devolver el valor guardado tal cual, incluido
// un 0 legítimo. Un `parseInt(...) || EXTRA_DEL_RASGO` trataría ese 0 como
// "no vino nada" y devolvería 1 de más por cada Pokémon con vínculo — el bug
// real que ya pasó en esta partida. La versión correcta distingue "no se pudo
// parsear" (NaN) de "se parseó un 0 válido" con Number.isFinite.
const stubRun = (extra) => async () => ({ rows: extra === undefined ? [] : [{ extra }] })

test('extraDelRasgo: sin fila (el entrenador no tiene el rasgo) → 0', async () => {
  const extra = await extraDelRasgo(1, stubRun(undefined))
  assert.equal(extra, 0)
})

test('extraDelRasgo: un 0 guardado se respeta, no se confunde con "sin valor"', async () => {
  const extra = await extraDelRasgo(1, stubRun('0'))
  assert.equal(extra, 0)
})

test('extraDelRasgo: un número guardado se devuelve tal cual', async () => {
  const extra = await extraDelRasgo(1, stubRun('5'))
  assert.equal(extra, 5)
})

test('extraDelRasgo: negativo se recorta a 0 (el extra nunca resta)', async () => {
  const extra = await extraDelRasgo(1, stubRun('-3'))
  assert.equal(extra, 0)
})

test('extraDelRasgo: valor no numérico cae al default de 1', async () => {
  const extra = await extraDelRasgo(1, stubRun(null))
  assert.equal(extra, 1)
})
