// Reglas puras del uso de TM (sin base de datos), para poder probarlas.

// Tope de movimientos aprendidos, sin contar Struggle (las pasivas viven en
// otra tabla y ya no cuentan)
const MAX_MOVIMIENTOS = 4

// Número del TM de un item de tipo TM: item_name_id 'tm-251' o, si no, el
// nombre "TM 251 - Curse"
const numeroTm = (item) => {
  const m = /^tm-0*(\d+)$/i.exec(String(item?.item_name_id || '').trim())
    || /^TM\s*0*(\d+)/i.exec(String(item?.item_name || '').trim())
  return m ? Number(m[1]) : null
}

// pokemon.pokemon_moves_tm viene como "1, 6, 9, 251"
const tmsCompatibles = (lista) => new Set(
  String(lista || '').split(/[,;\s]+/).map(Number).filter(n => Number.isInteger(n) && n > 0))

const esStruggle = (m) => String(m?.move_name_id || m?.move_name || '').trim().toLowerCase() === 'struggle'

// Movimientos que cuentan para el tope (todos menos Struggle)
const movimientosQueCuentan = (moves) => (moves || []).filter(m => !esStruggle(m))

const debeOlvidar = (moves) => movimientosQueCuentan(moves).length >= MAX_MOVIMIENTOS

module.exports = { MAX_MOVIMIENTOS, numeroTm, tmsCompatibles, esStruggle, movimientosQueCuentan, debeOlvidar }
