'use strict';

const Joi = require('joi');
const Constants = require('../constants/Constants');
const { normalizeEmail } = require('./email');

const VALIDATION_LIMITS = {
  experimentKeyMaxLength: 128,
  variantKeyMaxLength: 128,
  visitorIdMaxLength: 128,
  eventTypeMaxLength: 64,
  eventNameMaxLength: 128,
  apiKeyNameMaxLength: 100,
  emailMaxLength: 254,
  passwordMinLength: 8,
  passwordMaxLength: 128,
  variantMaxCount: 5,
  assignmentExperimentKeysMaxCount: 10,
  contentTextMaxLength: 5000,
  metadataMaxBytes: 16 * 1024,
  metadataMaxDepth: 5,
  earliestEventTimestamp: '2020-01-01T00:00:00.000Z',
  futureTimestampToleranceMs: 5 * 60 * 1000,
  paginationDefaultLimit: 20,
  paginationMaxLimit: 100
};

const keyPattern = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

const boundedKey = label => Joi.string()
  .trim()
  .min(1)
  .max(label === 'Variant key' ? VALIDATION_LIMITS.variantKeyMaxLength : VALIDATION_LIMITS.experimentKeyMaxLength)
  .pattern(keyPattern)
  .messages({
    'string.empty': `${label} cannot be empty`,
    'string.max': `${label} cannot exceed {#limit} characters`,
    'string.pattern.base': `${label} may contain only letters, numbers, underscores, hyphens, and dots, and must start with a letter or number`
  });

const getJsonDepth = (value) => {
  if (value === null || typeof value !== 'object') return 0;
  const children = Array.isArray(value) ? value : Object.values(value);
  if (children.length === 0) return 1;
  return 1 + Math.max(...children.map(getJsonDepth));
};

const metadataSchema = Joi.object().custom((value, helpers) => {
  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized, 'utf8') > VALIDATION_LIMITS.metadataMaxBytes) {
    return helpers.error('metadata.maxBytes');
  }
  if (getJsonDepth(value) > VALIDATION_LIMITS.metadataMaxDepth) {
    return helpers.error('metadata.maxDepth');
  }
  return value;
}).messages({
  'metadata.maxBytes': `metadata cannot exceed ${VALIDATION_LIMITS.metadataMaxBytes} bytes`,
  'metadata.maxDepth': `metadata cannot exceed ${VALIDATION_LIMITS.metadataMaxDepth} nested levels`
});

const eventTimestampSchema = Joi.string().isoDate().custom((value, helpers) => {
  const timestamp = new Date(value);
  const earliest = new Date(VALIDATION_LIMITS.earliestEventTimestamp);
  const latest = new Date(Date.now() + VALIDATION_LIMITS.futureTimestampToleranceMs);

  if (timestamp < earliest) {
    return helpers.error('occurredAt.tooOld');
  }
  if (timestamp > latest) {
    return helpers.error('occurredAt.future');
  }
  return value;
}).messages({
  'string.isoDate': 'occurredAt must be a valid ISO-8601 timestamp',
  'occurredAt.tooOld': `occurredAt cannot be earlier than ${VALIDATION_LIMITS.earliestEventTimestamp}`,
  'occurredAt.future': 'occurredAt cannot be more than 5 minutes in the future'
});

const variantSchema = Joi.object({
  key: boundedKey('Variant key').required().messages({
    'any.required': 'Variant key is required',
    'string.base': 'Variant key must be a string'
  }),
  allocation: Joi.number().integer().positive().required().messages({
    'any.required': 'Variant allocation is required',
    'number.base': 'Variant allocation must be a number',
    'number.integer': 'Variant allocation must be an integer',
    'number.positive': 'Variant allocation must be positive'
  }),
  content: Joi.object({
    type: Joi.string().valid('static_text').required(),
    text: Joi.string().trim().min(1).max(VALIDATION_LIMITS.contentTextMaxLength).required()
  }).optional()
});

const validateVariantContent = (variants, helpers) => {
  const variantsWithContent = variants.filter(variant => variant.content !== undefined);
  if (variantsWithContent.length !== 0 && variantsWithContent.length !== variants.length) {
    return helpers.error('variants.contentRequiredForAll');
  }
  return variants;
};

const createExperimentSchema = Joi.object({
  key: boundedKey('Experiment key').required().messages({
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
    .max(VALIDATION_LIMITS.variantMaxCount)
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

      return validateVariantContent(variants, helpers);
    })
    .messages({
      'any.required': 'Variants list is required',
      'array.min': 'An experiment must have at least two variants',
      'array.max': `An experiment cannot have more than ${VALIDATION_LIMITS.variantMaxCount} variants`,
      'variants.uniqueKeys': 'Variant keys must be unique within an experiment',
      'variants.totalAllocation': 'Variant allocations must total exactly 100',
      'variants.contentRequiredForAll': 'Content must be defined for every variant when content delivery is enabled'
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
    .max(VALIDATION_LIMITS.variantMaxCount)
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

      return validateVariantContent(variants, helpers);
    })
    .messages({
      'any.required': 'Variants list is required',
      'array.min': 'An experiment must have at least two variants',
      'array.max': `An experiment cannot have more than ${VALIDATION_LIMITS.variantMaxCount} variants`,
      'variants.uniqueKeys': 'Variant keys must be unique within an experiment',
      'variants.totalAllocation': 'Variant allocations must total exactly 100',
      'variants.contentRequiredForAll': 'Content must be defined for every variant when content delivery is enabled'
    })
});

// Assignment request validation
const assignmentRequestSchema = Joi.object({
  visitorId: Joi.string().trim().min(1).max(VALIDATION_LIMITS.visitorIdMaxLength).required().messages({
    'any.required': 'visitorId is required',
    'string.empty': 'visitorId cannot be empty',
    'string.max': `visitorId cannot exceed ${VALIDATION_LIMITS.visitorIdMaxLength} characters`
  }),
  experimentKeys: Joi.array()
    .items(boundedKey('Experiment key'))
    .min(1)
    .max(VALIDATION_LIMITS.assignmentExperimentKeysMaxCount)
    .unique()
    .required()
    .messages({
    'any.required': 'experimentKeys is required',
    'array.min': 'experimentKeys must contain at least one key',
    'array.max': `experimentKeys cannot contain more than ${VALIDATION_LIMITS.assignmentExperimentKeysMaxCount} keys`,
    'array.unique': 'experimentKeys must be unique'
  })
});

const experimentKeyParamSchema = boundedKey('Experiment key').required().messages({
  'any.required': 'Experiment key is required',
  'string.base': 'Experiment key must be a string'
});

// Exposure event validation
const exposureEventSchema = Joi.object({
  visitorId: Joi.string().trim().min(1).max(VALIDATION_LIMITS.visitorIdMaxLength).required().messages({
    'any.required': 'visitorId is required',
    'string.empty': 'visitorId cannot be empty',
    'string.max': `visitorId cannot exceed ${VALIDATION_LIMITS.visitorIdMaxLength} characters`
  }),
  experimentKey: boundedKey('Experiment key').required().messages({
    'any.required': 'experimentKey is required'
  }),
  variantKey: boundedKey('Variant key').required().messages({
    'any.required': 'variantKey is required'
  }),
  occurredAt: eventTimestampSchema.optional(),
  metadata: metadataSchema.optional()
});

// Telemetry event validation
const telemetryEventSchema = Joi.object({
  visitorId: Joi.string().trim().min(1).max(VALIDATION_LIMITS.visitorIdMaxLength).required().messages({
    'any.required': 'visitorId is required',
    'string.empty': 'visitorId cannot be empty',
    'string.max': `visitorId cannot exceed ${VALIDATION_LIMITS.visitorIdMaxLength} characters`
  }),
  experimentKey: boundedKey('Experiment key').required().messages({
    'any.required': 'experimentKey is required'
  }),
  variantKey: boundedKey('Variant key').optional(),
  eventType: Joi.string().trim().min(1).max(VALIDATION_LIMITS.eventTypeMaxLength).required().messages({
    'any.required': 'eventType is required'
  }),
  eventName: Joi.string().trim().min(1).max(VALIDATION_LIMITS.eventNameMaxLength).required().messages({
    'any.required': 'eventName is required'
  }),
  occurredAt: eventTimestampSchema.optional(),
  metadata: metadataSchema.optional()
}).custom((value, helpers) => {
  if (value.eventType !== Constants.EventTypes.Conversion && !value.variantKey) {
    return helpers.error('variantKey.required');
  }
  return value;
}).messages({
  'variantKey.required': 'variantKey is required for non-conversion telemetry'
});

const signupSchema = Joi.object({
  email: Joi.string().trim().email().max(VALIDATION_LIMITS.emailMaxLength).custom(normalizeEmail).required().messages({
    'any.required': 'Email is required',
    'string.email': 'Email must be a valid email address',
    'string.max': `Email cannot exceed ${VALIDATION_LIMITS.emailMaxLength} characters`,
    'string.empty': 'Email cannot be empty'
  }),
  password: Joi.string().min(VALIDATION_LIMITS.passwordMinLength).max(VALIDATION_LIMITS.passwordMaxLength).required().messages({
    'any.required': 'Password is required',
    'string.min': `Password must be at least ${VALIDATION_LIMITS.passwordMinLength} characters long`,
    'string.max': `Password cannot exceed ${VALIDATION_LIMITS.passwordMaxLength} characters`,
    'string.empty': 'Password cannot be empty'
  })
});

const loginSchema = Joi.object({
  email: Joi.string().trim().email().max(VALIDATION_LIMITS.emailMaxLength).custom(normalizeEmail).required().messages({
    'any.required': 'Email is required',
    'string.email': 'Email must be a valid email address',
    'string.max': `Email cannot exceed ${VALIDATION_LIMITS.emailMaxLength} characters`,
    'string.empty': 'Email cannot be empty'
  }),
  password: Joi.string().max(VALIDATION_LIMITS.passwordMaxLength).required().messages({
    'any.required': 'Password is required',
    'string.max': `Password cannot exceed ${VALIDATION_LIMITS.passwordMaxLength} characters`,
    'string.empty': 'Password cannot be empty'
  })
});

const createKeySchema = Joi.object({
  name: Joi.string().trim().min(1).max(VALIDATION_LIMITS.apiKeyNameMaxLength).required().messages({
    'any.required': 'API Key name is required',
    'string.max': `API Key name cannot exceed ${VALIDATION_LIMITS.apiKeyNameMaxLength} characters`,
    'string.empty': 'API Key name cannot be empty'
  }),
  expiresAt: Joi.string().isoDate().required().custom((value, helpers) => {
    const expiresAt = new Date(value);
    const now = new Date();
    const maximumExpiry = new Date(now);
    maximumExpiry.setFullYear(maximumExpiry.getFullYear() + 1);
    if (expiresAt <= now) {
      return helpers.error('expiresAt.future');
    }
    if (expiresAt > maximumExpiry) {
      return helpers.error('expiresAt.maximum');
    }
    return value;
  }).messages({
    'any.required': 'API key expiration is required',
    'string.isoDate': 'expiresAt must be a valid ISO-8601 timestamp',
    'expiresAt.future': 'Expiration must be a future date',
    'expiresAt.maximum': 'API key expiration cannot exceed one year'
  })
});

const paginationSchema = Joi.object({
  limit: Joi.number()
    .integer()
    .min(1)
    .max(VALIDATION_LIMITS.paginationMaxLimit)
    .default(VALIDATION_LIMITS.paginationDefaultLimit)
    .messages({
      'number.base': 'limit must be a number',
      'number.integer': 'limit must be an integer',
      'number.min': 'limit must be at least 1',
      'number.max': `limit cannot exceed ${VALIDATION_LIMITS.paginationMaxLimit}`
    }),
  offset: Joi.number()
    .integer()
    .min(0)
    .default(0)
    .messages({
      'number.base': 'offset must be a number',
      'number.integer': 'offset must be an integer',
      'number.min': 'offset cannot be negative'
    })
});

module.exports = {
  createExperimentSchema,
  updateExperimentSchema,
  experimentKeyParamSchema,
  assignmentRequestSchema,
  exposureEventSchema,
  telemetryEventSchema,
  signupSchema,
  loginSchema,
  createKeySchema,
  paginationSchema,
  VALIDATION_LIMITS
};
