'use strict';

const resultsController = require('../controllers/results-controller');

const getResults = async (req, res, next) => {
  try {
    const result = await resultsController.getResults(req.params.experimentKey);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getResults
};
