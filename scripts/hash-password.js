// Genera el hash bcrypt de una clave, con el mismo costo (10) que usa la app,
// para pegarlo en el INSERT de un usuario nuevo.
//
// Uso: node scripts/hash-password.js "la-clave"
const bcrypt = require('bcrypt')

const clave = process.argv[2]
if (!clave) {
  console.error('Uso: node scripts/hash-password.js "la-clave"')
  process.exit(1)
}
bcrypt.hash(clave, 10).then(h => console.log(h))
