export const VALIDATION_LIMITS = {
  experimentKeyMaxLength: 128,
  variantKeyMaxLength: 128,
  visitorIdMaxLength: 128,
  apiKeyNameMaxLength: 100,
  emailMaxLength: 254,
  passwordMinLength: 8,
  passwordMaxLength: 128,
  variantMaxCount: 5,
  paginationDefaultLimit: 20,
  paginationMaxLimit: 100,
  contentTextMaxLength: 5000
};

export const experimentKeyPattern = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

export const experimentKeyHelpText = 'Use letters, numbers, underscores, hyphens, or dots. Must start with a letter or number.';

export const normalizeEmail = email => email.trim().toLowerCase();
