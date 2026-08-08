// Lectura del dado de golpe: "1d6" → 6.
//
// Sin dado legible se cae al d6, que es con el que el creador de personajes los
// da de alta. Nunca a "sin tope": con 0 la validación aceptaría cualquier
// número, y hay personajes viejos con personaje_hit_dice en NULL.
//
// Vive aparte porque lo usan la subida de nivel y el descanso corto, y las dos
// validan tiradas contra él: si se separaran, una aceptaría lo que la otra no.
const DADO_POR_DEFECTO = 6

const hitDiceMax = s => {
  const m = /d\s*(\d+)/i.exec(s || '')
  const n = m ? Number(m[1]) : 0
  return n > 0 ? n : DADO_POR_DEFECTO
}

module.exports = { hitDiceMax, DADO_POR_DEFECTO }
