// Clave para comparar nombres de movimientos. La Pokédex escribe "Double Edge"
// o "Will O Wisp" y el catálogo de movimientos "Double-Edge" o "Will-O-Wisp":
// comparar solo en minúsculas dejaba fuera todos los que llevan guion,
// apóstrofo o punto. Se quita todo lo que no sea letra o número.
const claveMove = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

// El mismo criterio en SQL, para comparar contra move_name de la tabla
const SQL_CLAVE_MOVE = (col) => `regexp_replace(lower(${col}), '[^a-z0-9]', '', 'g')`

module.exports = { claveMove, SQL_CLAVE_MOVE }
