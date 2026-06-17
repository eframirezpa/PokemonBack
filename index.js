const app  = require('./src/app')
const PORT = process.env.PORT || 3001

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`)
    console.log(`Health check: http://localhost:${PORT}/api/health`)
  })
}

module.exports = app
