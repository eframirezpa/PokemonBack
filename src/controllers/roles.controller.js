const svc = require('../services/roles.service')

const getAll = async (_req, res, next) => {
  try {
    res.json(await svc.findAll())
  } catch (e) { next(e) }
}

module.exports = { getAll }
