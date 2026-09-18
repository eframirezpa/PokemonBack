// Corre las migraciones pendientes de back/migrations/, en orden por nombre
// de archivo, y registra cuáles ya se aplicaron en juego.schema_migrations —
// así correr este script de nuevo (en local o en producción) es seguro:
// una migración ya aplicada simplemente se salta.
//
// Reemplaza {{schema}} en el .sql por el schema real antes de ejecutarlo, para
// que las migraciones no dependan de que siempre se llame "juego".
//
// Uso: npm run migrate
const fs   = require('fs')
const path = require('path')
const { query, transaction, SCHEMA } = require('../src/config/db')

const DIR = path.join(__dirname, '..', 'migrations')

async function asegurarTablaControl() {
  await query(`
    CREATE TABLE IF NOT EXISTS "${SCHEMA}"."schema_migrations" (
      name        text PRIMARY KEY,
      applied_at  timestamptz NOT NULL DEFAULT now()
    )
  `)
}

async function aplicadas() {
  const { rows } = await query(`SELECT name FROM "${SCHEMA}"."schema_migrations"`)
  return new Set(rows.map(r => r.name))
}

async function main() {
  const archivos = fs.existsSync(DIR)
    ? fs.readdirSync(DIR).filter(f => f.endsWith('.sql')).sort()
    : []

  await asegurarTablaControl()
  const yaAplicadas = await aplicadas()

  const pendientes = archivos.filter(f => !yaAplicadas.has(f))
  if (pendientes.length === 0) {
    console.log('Nada que migrar: todo al día.')
    return
  }

  for (const archivo of pendientes) {
    const sql = fs.readFileSync(path.join(DIR, archivo), 'utf8').replaceAll('{{schema}}', SCHEMA)
    console.log(`Aplicando ${archivo}...`)
    await transaction(async client => {
      await client.query(sql)
      await client.query(`INSERT INTO "${SCHEMA}"."schema_migrations" (name) VALUES ($1)`, [archivo])
    })
    console.log('  ok')
  }
  console.log(`Listo: ${pendientes.length} migración(es) aplicada(s).`)
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error(e.message); process.exit(1) })
