const { test } = require('node:test')
const assert = require('node:assert/strict')
const { vidaDeNivel, NIVEL_MIN, NIVEL_MAX } = require('../src/services/master_npc.service')

test('vidaDeNivel: nivel 1 no tira dados, es exactamente la base', () => {
  assert.equal(vidaDeNivel(1), 6)
})

test('vidaDeNivel: nivel N cae dentro de HP_BASE + subidas + [subidas, subidas*6]', () => {
  for (const nivel of [2, 5, 10, 15, 20]) {
    const subidas = nivel - 1
    const min = 6 + subidas + subidas * 1
    const max = 6 + subidas + subidas * 6
    for (let i = 0; i < 20; i++) {
      const hp = vidaDeNivel(nivel)
      assert.ok(hp >= min && hp <= max, `nivel ${nivel}: ${hp} fuera de [${min}, ${max}]`)
    }
  }
})

test('vidaDeNivel: topa el nivel al rango válido en vez de romperse con basura', () => {
  assert.equal(vidaDeNivel(0), 6)          // por debajo del mínimo → nivel 1
  assert.equal(vidaDeNivel(-5), 6)
  assert.equal(vidaDeNivel(null), 6)
  assert.equal(vidaDeNivel(undefined), 6)
  assert.equal(vidaDeNivel('no es un número'), 6)

  // 2.9 trunca a nivel 2 (una subida, un d6): igual que vidaDeNivel(2)
  const hpDecimal = vidaDeNivel(2.9)
  assert.ok(hpDecimal >= 7 && hpDecimal <= 12, `2.9 debería comportarse como nivel 2, dio ${hpDecimal}`)

  const hpNivelMax = vidaDeNivel(NIVEL_MAX + 100)
  const subidasMax = NIVEL_MAX - 1
  assert.ok(hpNivelMax >= 6 + subidasMax + subidasMax * 1)
  assert.ok(hpNivelMax <= 6 + subidasMax + subidasMax * 6)
})

test('NIVEL_MIN/NIVEL_MAX: rango del juego (1 a 20)', () => {
  assert.equal(NIVEL_MIN, 1)
  assert.equal(NIVEL_MAX, 20)
})
