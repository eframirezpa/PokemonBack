require('dotenv').config()
const express = require('express')
const cors    = require('cors')

const pokemonRoutes    = require('./routes/pokemon.routes')
const movesRoutes      = require('./routes/moves.routes')
const abilitiesRoutes  = require('./routes/abilities.routes')
const itemsRoutes      = require('./routes/items.routes')
const tmRoutes         = require('./routes/tm.routes')
const evolutionRoutes  = require('./routes/evolution.routes')
const typesRoutes      = require('./routes/types.routes')

const app = express()

app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
}))
app.use(express.json())

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Rutas
app.use('/api/pokemon',    pokemonRoutes)
app.use('/api/moves',      movesRoutes)
app.use('/api/abilities',  abilitiesRoutes)
app.use('/api/items',      itemsRoutes)
app.use('/api/tm',         tmRoutes)
app.use('/api/evolution',  evolutionRoutes)
app.use('/api/types',      typesRoutes)

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado' })
})

// Error handler global
app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'Error interno del servidor' })
})

module.exports = app
