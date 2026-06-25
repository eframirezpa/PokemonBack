require('dotenv').config()
const path    = require('path')
const express = require('express')
const cors    = require('cors')

const authRoutes             = require('./routes/auth.routes')
const rolesRoutes            = require('./routes/roles.routes')
const usuariosRoutes         = require('./routes/usuarios.routes')
const pokemonRoutes          = require('./routes/pokemon.routes')
const movesRoutes            = require('./routes/moves.routes')
const abilitiesRoutes        = require('./routes/abilities.routes')
const itemsRoutes            = require('./routes/items.routes')
const tmRoutes               = require('./routes/tm.routes')
const evolutionRoutes        = require('./routes/evolution.routes')
const typesRoutes            = require('./routes/types.routes')
const armorTypesRoutes       = require('./routes/armor_types.routes')
const backgroundsRoutes      = require('./routes/backgrounds.routes')
const bondsRoutes            = require('./routes/bonds.routes')
const featsRoutes            = require('./routes/feats.routes')
const naturesRoutes          = require('./routes/natures.routes')
const originsRoutes          = require('./routes/origins.routes')
const weaponPropertiesRoutes = require('./routes/weapon_properties.routes')
const weaponTypesRoutes      = require('./routes/weapon_types.routes')
const partidaRoutes          = require('./routes/partida.routes')
const avatarRoutes           = require('./routes/avatar.routes')
const personajeRoutes        = require('./routes/personaje.routes')
const featsBonusRoutes       = require('./routes/feats_bonus.routes')
const skillsRoutes           = require('./routes/skills.routes')

const app = express()

app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
}))
app.use(express.json())
app.use(express.static(path.join(__dirname, '../public')))

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Debug: ver config de DB (sin password)
app.get('/api/debug', (_req, res) => {
  res.json({
    DB_HOST:   process.env.DB_HOST     || '(no definido)',
    DB_PORT:   process.env.DB_PORT     || '(no definido)',
    DB_NAME:   process.env.DB_NAME     || '(no definido)',
    DB_USER:   process.env.DB_USER     || '(no definido)',
    DB_SSL:    process.env.DB_SSL      || '(no definido)',
    DB_SCHEMA: process.env.DB_SCHEMA   || '(no definido)',
    HAS_PASS:  !!process.env.DB_PASSWORD,
  })
})

// Rutas
app.use('/api/auth',              authRoutes)
app.use('/api/roles',             rolesRoutes)
app.use('/api/usuarios',          usuariosRoutes)
app.use('/api/pokemon',           pokemonRoutes)
app.use('/api/moves',             movesRoutes)
app.use('/api/abilities',         abilitiesRoutes)
app.use('/api/items',             itemsRoutes)
app.use('/api/tm',                tmRoutes)
app.use('/api/evolution',         evolutionRoutes)
app.use('/api/types',             typesRoutes)
app.use('/api/armor-types',       armorTypesRoutes)
app.use('/api/backgrounds',       backgroundsRoutes)
app.use('/api/bonds',             bondsRoutes)
app.use('/api/feats',             featsRoutes)
app.use('/api/natures',           naturesRoutes)
app.use('/api/origins',           originsRoutes)
app.use('/api/weapon-properties', weaponPropertiesRoutes)
app.use('/api/weapon-types',      weaponTypesRoutes)
app.use('/api/partida',           partidaRoutes)
app.use('/api/avatar',            avatarRoutes)
app.use('/api/personaje',         personajeRoutes)
app.use('/api/feats-bonus',       featsBonusRoutes)
app.use('/api/skills',            skillsRoutes)

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado' })
})

// Error handler global
app.use((err, _req, res, _next) => {
  console.error('GLOBAL ERROR:', err.message, err.code, err.stack)
  res.status(500).json({ error: 'Error interno del servidor', detail: err.message })
})

module.exports = app
