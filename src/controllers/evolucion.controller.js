const svc = require('../services/evolucion.service')

const ERRORES = {
  notfound:  [404, 'Pokémon no encontrado'],
  opcion:    [400, 'Esa evolución no corresponde a este Pokémon'],
  pospuesta: [409, 'Pospusiste la evolución en este nivel; podrás evolucionar al subir de nivel'],
  especial:  [400, 'Esta evolución tiene un efecto especial que debe resolver el DM'],
  condicion: [400, 'No se cumplen las condiciones de la evolución'],
  confirmar: [400, 'Falta que el DM confirme alguna condición'],
  pasiva:    [400, 'Elige una habilidad de la forma evolucionada'],
}

const responder = (res, r) => {
  if (r.error === 'puntos') {
    const msg = {
      entero:   'Los puntos deben ser enteros positivos',
      por_stat: 'No se pueden poner más de 4 puntos en un mismo stat',
      tope:     `Ningún stat puede pasar de ${r.tope || 20}`,
      suma:     `Debes repartir ${r.debe} puntos`,
    }[r.detalle] || 'Reparto de puntos no válido'
    return res.status(400).json({ error: msg })
  }
  const e = ERRORES[r.error]
  if (e) return res.status(e[0]).json({ error: e[1] })
  res.json(r)
}

// GET /api/personaje/:id/pokemon/:idpp/evolucion
const getOpciones = async (req, res, next) => {
  try { responder(res, await svc.opciones(req.params.id, req.params.idpp)) } catch (e) { next(e) }
}

// POST /api/personaje/:id/pokemon/:idpp/evolucion  { evolution_id, stat_adds, id_abilitie?, confirmadas }
const evolucionar = async (req, res, next) => {
  try { responder(res, await svc.evolucionar(req.params.id, req.params.idpp, req.body || {})) } catch (e) { next(e) }
}

// POST /api/personaje/:id/pokemon/:idpp/evolucion/posponer
const posponer = async (req, res, next) => {
  try { responder(res, await svc.posponer(req.params.id, req.params.idpp)) } catch (e) { next(e) }
}

module.exports = { getOpciones, evolucionar, posponer }
