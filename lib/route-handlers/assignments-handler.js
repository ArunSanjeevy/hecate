'use strict';

const assignmentsController = require('../controllers/assignments-controller');

const getAssignments = async (req, res, next) => {
  try {
    const result = await assignmentsController.getAssignments(req.body, req.user.id);
    const responseBody = {
      assignments: result.assignments
    };
    if (result.errors && result.errors.length > 0) {
      responseBody.errors = result.errors;
    }
    return res.status(200).json(responseBody);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAssignments
};
