'use strict';

const Joi = require('joi');
const Constants = require('../constants/Constants');

const variantSchema = Joi.object({
  key: Joi.string().required().messages({
    'any.required': 'Variant key is required',
    'string.base': 'Variant key must be a string'
  }),
  allocation: Joi.number().integer().positive().required().messages({
    'any.required': 'Variant allocation is required',
    'number.base': 'Variant allocation must be a number',
    'number.integer': 'Variant allocation must be an integer',
    'number.positive': 'Variant allocation must be positive'
  })
});

const createExperimentSchema = Joi.object({
  key: Joi.string().required().messages({
    'any.required': 'Experiment key is required',
    'string.base': 'Experiment key must be a string'
  }),
  status: Joi.string()
    .valid(...Object.values(Constants.ExperimentStatus))
    .required()
    .messages({
      'any.required': 'Experiment status is required',
      'any.only': 'Experiment status must be draft, active, paused, or archived'
    }),
  variants: Joi.array()
    .items(variantSchema)
    .min(2)
    .required()
    .custom((variants, helpers) => {
      const keys = variants.map(v => v.key);
      const uniqueKeys = new Set(keys);
      if (uniqueKeys.size !== keys.length) {
        return helpers.error('variants.uniqueKeys');
      }

      const totalAllocation = variants.reduce((sum, v) => sum + v.allocation, 0);
      if (totalAllocation !== 100) {
        return helpers.error('variants.totalAllocation');
      }

      return variants;
    })
    .messages({
      'any.required': 'Variants list is required',
      'array.min': 'An experiment must have at least two variants',
      'variants.uniqueKeys': 'Variant keys must be unique within an experiment',
      'variants.totalAllocation': 'Variant allocations must total exactly 100'
    })
});

const updateExperimentSchema = Joi.object({
  status: Joi.string()
    .valid(...Object.values(Constants.ExperimentStatus))
    .required()
    .messages({
      'any.required': 'Experiment status is required',
      'any.only': 'Experiment status must be draft, active, paused, or archived'
    }),
  variants: Joi.array()
    .items(variantSchema)
    .min(2)
    .required()
    .custom((variants, helpers) => {
      const keys = variants.map(v => v.key);
      const uniqueKeys = new Set(keys);
      if (uniqueKeys.size !== keys.length) {
        return helpers.error('variants.uniqueKeys');
      }

      const totalAllocation = variants.reduce((sum, v) => sum + v.allocation, 0);
      if (totalAllocation !== 100) {
        return helpers.error('variants.totalAllocation');
      }

      return variants;
    })
    .messages({
      'any.required': 'Variants list is required',
      'array.min': 'An experiment must have at least two variants',
      'variants.uniqueKeys': 'Variant keys must be unique within an experiment',
      'variants.totalAllocation': 'Variant allocations must total exactly 100'
    })
});

// Assignment request validation
const assignmentRequestSchema = Joi.object({
  visitorId: Joi.string().required().messages({
    'any.required': 'visitorId is required',
    'string.empty': 'visitorId cannot be empty'
  }),
  experimentKeys: Joi.array().items(Joi.string()).min(1).required().messages({
    'any.required': 'experimentKeys is required',
    'array.min': 'experimentKeys must contain at least one key'
  })
});

// Exposure event validation
const exposureEventSchema = Joi.object({
  visitorId: Joi.string().required().messages({
    'any.required': 'visitorId is required',
    'string.empty': 'visitorId cannot be empty'
  }),
  experimentKey: Joi.string().required().messages({
    'any.required': 'experimentKey is required'
  }),
  variantKey: Joi.string().required().messages({
    'any.required': 'variantKey is required'
  }),
  occurredAt: Joi.string().isoDate().optional().messages({
    'string.isoDate': 'occurredAt must be a valid ISO-8601 timestamp'
  }),
  metadata: Joi.object().optional()
});

// Telemetry event validation
const telemetryEventSchema = Joi.object({
  visitorId: Joi.string().required().messages({
    'any.required': 'visitorId is required',
    'string.empty': 'visitorId cannot be empty'
  }),
  experimentKey: Joi.string().required().messages({
    'any.required': 'experimentKey is required'
  }),
  variantKey: Joi.string().required().messages({
    'any.required': 'variantKey is required'
  }),
  eventType: Joi.string().required().messages({
    'any.required': 'eventType is required'
  }),
  eventName: Joi.string().required().messages({
    'any.required': 'eventName is required'
  }),
  occurredAt: Joi.string().isoDate().optional().messages({
    'string.isoDate': 'occurredAt must be a valid ISO-8601 timestamp'
  }),
  metadata: Joi.object().optional()
});

module.exports = {
  createExperimentSchema,
  updateExperimentSchema,
  assignmentRequestSchema,
  exposureEventSchema,
  telemetryEventSchema
};
