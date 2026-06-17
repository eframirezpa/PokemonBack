const svc = require('../services/types.service')

const getTypes = async (_req, res, next) => {
  try {
    res.json(await svc.findAllTypes())
  } catch (e) { next(e) }
}

const getEffectiveness = async (req, res, next) => {
  try {
    const { attacking = '', defending = '' } = req.query
    res.json(await svc.findEffectiveness({ attackingType: attacking, defendingType: defending }))
  } catch (e) { next(e) }
}

module.exports = { getTypes, getEffectiveness }
