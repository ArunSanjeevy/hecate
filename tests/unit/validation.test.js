'use strict';

const {
  assignmentRequestSchema,
  createExperimentSchema,
  exposureEventSchema,
  telemetryEventSchema,
  signupSchema,
  createKeySchema,
  experimentKeyParamSchema,
  paginationSchema,
  VALIDATION_LIMITS
} = require('../../lib/helpers/validation');
const { normalizeEmail } = require('../../lib/helpers/email');

const validVariants = [
  { key: 'control', allocation: 50 },
  { key: 'treatment', allocation: 50 }
];

describe('request validation limits', () => {
  test('accepts a normal experiment payload', () => {
    const { error } = createExperimentSchema.validate({
      key: 'checkout_button_text',
      status: 'draft',
      variants: validVariants
    });

    expect(error).toBeUndefined();
  });

  test('rejects invalid experiment keys', () => {
    const { error } = createExperimentSchema.validate({
      key: '../checkout',
      status: 'draft',
      variants: validVariants
    });

    expect(error).toBeDefined();
    expect(error.message).toContain('Experiment key');
  });

  test('rejects too many variants', () => {
    const variants = Array.from({ length: VALIDATION_LIMITS.variantMaxCount + 1 }, (_, index) => ({
      key: `v${index}`,
      allocation: index === 0 ? 100 : 1
    }));

    const { error } = createExperimentSchema.validate({
      key: 'too_many_variants',
      status: 'draft',
      variants
    });

    expect(error).toBeDefined();
    expect(error.message).toContain('more than');
  });

  test('rejects too many experiment keys in assignment requests', () => {
    const { error } = assignmentRequestSchema.validate({
      visitorId: 'visitor-1',
      experimentKeys: Array.from(
        { length: VALIDATION_LIMITS.assignmentExperimentKeysMaxCount + 1 },
        (_, index) => `experiment_${index}`
      )
    });

    expect(error).toBeDefined();
    expect(error.message).toContain('experimentKeys cannot contain more than');
  });

  test('rejects oversized visitor IDs', () => {
    const { error } = assignmentRequestSchema.validate({
      visitorId: 'v'.repeat(VALIDATION_LIMITS.visitorIdMaxLength + 1),
      experimentKeys: ['checkout']
    });

    expect(error).toBeDefined();
    expect(error.message).toContain('visitorId cannot exceed');
  });

  test('rejects metadata that is too deeply nested', () => {
    const { error } = exposureEventSchema.validate({
      visitorId: 'visitor-1',
      experimentKey: 'checkout',
      variantKey: 'control',
      metadata: { a: { b: { c: { d: { e: { f: 'too-deep' } } } } } }
    });

    expect(error).toBeDefined();
    expect(error.message).toContain('metadata cannot exceed');
  });

  test('rejects metadata that is too large', () => {
    const { error } = telemetryEventSchema.validate({
      visitorId: 'visitor-1',
      experimentKey: 'checkout',
      variantKey: 'control',
      eventType: 'commerce',
      eventName: 'add_to_cart',
      metadata: {
        payload: 'x'.repeat(VALIDATION_LIMITS.metadataMaxBytes)
      }
    });

    expect(error).toBeDefined();
    expect(error.message).toContain('metadata cannot exceed');
  });

  test('rejects event timestamps too far in the future', () => {
    const future = new Date(Date.now() + VALIDATION_LIMITS.futureTimestampToleranceMs + 60 * 1000).toISOString();

    const { error } = exposureEventSchema.validate({
      visitorId: 'visitor-1',
      experimentKey: 'checkout',
      variantKey: 'control',
      occurredAt: future
    });

    expect(error).toBeDefined();
    expect(error.message).toContain('occurredAt cannot be more than');
  });

  test('rejects event timestamps before the supported lower bound', () => {
    const { error } = exposureEventSchema.validate({
      visitorId: 'visitor-1',
      experimentKey: 'checkout',
      variantKey: 'control',
      occurredAt: '2019-12-31T23:59:59.000Z'
    });

    expect(error).toBeDefined();
    expect(error.message).toContain('occurredAt cannot be earlier');
  });

  test('rejects oversized passwords and API key names', () => {
    expect(signupSchema.validate({
      email: 'owner@example.com',
      password: 'p'.repeat(VALIDATION_LIMITS.passwordMaxLength + 1)
    }).error).toBeDefined();

    expect(createKeySchema.validate({
      name: 'k'.repeat(VALIDATION_LIMITS.apiKeyNameMaxLength + 1),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    }).error).toBeDefined();
  });

  test('normalizes emails before auth controllers store or query them', () => {
    expect(signupSchema.validate({
      email: '  Owner@Example.COM  ',
      password: 'correct-horse-battery-staple'
    }).value.email).toBe('owner@example.com');
  });

  test('normalizes email helper output consistently', () => {
    expect(normalizeEmail('  OWNER+Demo@Example.COM  ')).toBe('owner+demo@example.com');
  });

  test('validates experiment keys from route params', () => {
    expect(experimentKeyParamSchema.validate('checkout_button_text').error).toBeUndefined();
    expect(experimentKeyParamSchema.validate('/checkout').error).toBeDefined();
  });

  test('normalizes basic pagination query params', () => {
    const { error, value } = paginationSchema.validate({ limit: '10', offset: '20' }, { convert: true });

    expect(error).toBeUndefined();
    expect(value).toEqual({ limit: 10, offset: 20 });
  });

  test('rejects invalid pagination query params', () => {
    expect(paginationSchema.validate({ limit: '101', offset: '0' }, { convert: true }).error).toBeDefined();
    expect(paginationSchema.validate({ limit: '10', offset: '-1' }, { convert: true }).error).toBeDefined();
  });
});
