/**
 * Turno y ronda tras pasar el turno hacia adelante o hacia atrás.
 *
 * - Adelante: del último participante al primero entra una ronda nueva.
 * - Atrás: del primero al último se vuelve a la ronda anterior. En el primer
 *   turno de la ronda 1 no hay nada antes: se queda donde está.
 */
const pasoDeTurno = ({ turno, ronda, total, direccion }) => {
  const atras = direccion === 'anterior'
  if (atras && turno === 0 && ronda <= 1) return { turno, ronda }
  const siguiente = (turno + (atras ? -1 : 1) + total) % total
  if (!atras && siguiente === 0) return { turno: siguiente, ronda: ronda + 1 }
  if (atras && turno === 0)      return { turno: siguiente, ronda: ronda - 1 }
  return { turno: siguiente, ronda }
}

module.exports = { pasoDeTurno }
