const { test } = require('node:test')
const assert = require('node:assert/strict')
const { aplicarAStatsPokemon } = require('../src/lib/path_stats')

const statsBase = (over = {}) => ({
  pokemon_dex: 10, pokemon_dex_bonus: 0,
  pokemon_str: 10, pokemon_str_bonus: 0,
  ...over,
})

test('aplicarAStatsPokemon: tope 20 por debajo de nivel 20', () => {
  const stats = statsBase({ pokemon_dex: 18, pokemon_dex_bonus: 0 })
  const out = aplicarAStatsPokemon(stats, { dex: 5 }, { nivel: 10 })
  // 18 + bonus cabe hasta 20 → solo entran 2, no los 5 completos
  assert.equal(out.pokemon_dex_bonus, 2)
})

test('aplicarAStatsPokemon: tope sube a 22 en nivel 20', () => {
  const stats = statsBase({ pokemon_dex: 18, pokemon_dex_bonus: 0 })
  const out = aplicarAStatsPokemon(stats, { dex: 5 }, { nivel: 20 })
  assert.equal(out.pokemon_dex_bonus, 4) // 18 + 4 = 22, tope de nivel 20
})

test('aplicarAStatsPokemon: el tope se mide sobre base + bonus + feats, no solo la base', () => {
  const stats = statsBase({ pokemon_dex: 18, pokemon_dex_bonus: 1 })
  // ya suma 19 (18 base + 1 bonus); con stat_extra de un feat +1 más son 20 ya ocupados
  const out = aplicarAStatsPokemon(stats, { dex: 5 }, {
    nivel: 10, efectos: { stat_extra: { dex: 1 } },
  })
  assert.equal(out.pokemon_dex_bonus, 1) // no cabe nada más: ya estaba en el tope
})

test('aplicarAStatsPokemon: stat_cap de un feat (ej. Gifted) puede subir el tope antes de nivel 20', () => {
  const stats = statsBase({ pokemon_dex: 18, pokemon_dex_bonus: 0 })
  const out = aplicarAStatsPokemon(stats, { dex: 5 }, {
    nivel: 5, efectos: { stat_cap: { dex: 22 } },
  })
  assert.equal(out.pokemon_dex_bonus, 4) // tope 22 en vez de 20
})

test('aplicarAStatsPokemon: sin bono para esa stat, no toca nada', () => {
  const stats = statsBase()
  const out = aplicarAStatsPokemon(stats, { dex: 0 }, { nivel: 5 })
  assert.equal(out.pokemon_dex_bonus, 0)
})

test('aplicarAStatsPokemon: sin stats no revienta, devuelve tal cual', () => {
  assert.equal(aplicarAStatsPokemon(null, { dex: 5 }, { nivel: 5 }), null)
})
