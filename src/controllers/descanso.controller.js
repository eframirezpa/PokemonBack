// Descansos largo y corto. El visto bueno del DM se pide en la interfaz; el
// backend solo aplica el efecto sobre quienes lleguen en la petición.
const svc = require('../services/descanso.service')

// GET /personaje/:id/rest → entrenador y Pokémon que pueden descansar
const getParticipantes = async (req, res, next) => {
  try {
    const r = await svc.participantes(req.params.id)
    if (r.error === 'notfound') return res.status(404).json({ error: 'Personaje no encontrado' })
    res.json(r)
  } catch (e) { next(e) }
}

// POST /personaje/:id/rest/long  { entrenador, pokemons: [] }
const longRest = async (req, res, next) => {
  try {
    const r = await svc.longRest(req.params.id, req.body)
    if (r.error === 'empty')    return res.status(400).json({ error: 'Hay que elegir al menos a uno' })
    if (r.error === 'notfound') return res.status(404).json({ error: 'No encontrado' })
    res.json(r)
  } catch (e) { next(e) }
}

// POST /personaje/:id/rest/short  { objetivo, idpp, dados, resultado }
const shortRest = async (req, res, next) => {
  try {
    const r = await svc.shortRest(req.params.id, req.body)
    if (r.error === 'notfound') return res.status(404).json({ error: 'No encontrado' })
    if (r.error === 'dados')    return res.status(409).json({ error: 'No hay tantos dados de golpe', disponibles: r.disponibles })
    if (r.error === 'tirada')   return res.status(400).json({ error: `La tirada debe estar entre ${r.min} y ${r.max}`, min: r.min, max: r.max })
    res.json(r)
  } catch (e) { next(e) }
}

module.exports = { getParticipantes, longRest, shortRest }
