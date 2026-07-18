import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';

// Automatically clean up all mocks after each test
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
