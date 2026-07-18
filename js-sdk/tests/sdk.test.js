import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import { createHecateClient } from '../src/index.js';

describe('Hecate Browser JS SDK Suite', () => {
  let originalFetch;
  let originalCookieDescriptor;
  let originalLocalStorageDescriptor;

  beforeAll(() => {
    originalCookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
  });

  beforeEach(() => {
    // Save and mock global fetch
    originalFetch = global.fetch;
    global.fetch = jest.fn();

    // Clear cookies safely
    if (typeof document !== 'undefined' && originalCookieDescriptor) {
      Object.defineProperty(Document.prototype, 'cookie', originalCookieDescriptor);
      document.cookie.split(';').forEach(c => {
        document.cookie = c
          .replace(/^ +/, '')
          .replace(/=.*/, '=;expires=' + new Date(0).toUTCString() + ';path=/');
      });
    }

    // Clear localStorage safely
    if (typeof localStorage !== 'undefined' && originalLocalStorageDescriptor) {
      Object.defineProperty(window, 'localStorage', originalLocalStorageDescriptor);
      localStorage.clear();
    }

    jest.useFakeTimers();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
    jest.restoreAllMocks();

    // Restore descriptors
    if (originalCookieDescriptor) {
      Object.defineProperty(Document.prototype, 'cookie', originalCookieDescriptor);
    }
    if (originalLocalStorageDescriptor) {
      Object.defineProperty(window, 'localStorage', originalLocalStorageDescriptor);
    }
  });

  // Helper to create mock fetch responses
  function mockFetchResponse(status, data) {
    global.fetch.mockImplementation(() =>
      Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(data)
      })
    );
  }

  describe('Visitor ID Generation and Persistence', () => {
    it('should generate a valid UUID when visitorId is not supplied', () => {
      const client = createHecateClient({ baseUrl: 'http://localhost:4000' });
      const visitorId = client.getVisitorId();
      expect(visitorId).toBeDefined();
      expect(visitorId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should persist generated visitorId in cookies by default', () => {
      const client = createHecateClient({ baseUrl: 'http://localhost:4000' });
      const visitorId = client.getVisitorId();
      expect(document.cookie).toContain(`hecate_visitor_id=${visitorId}`);
      expect(client.persistedVia).toBe('cookie');
    });

    it('should fall back to localStorage if cookie write fails', () => {
      // Mock cookie block
      Object.defineProperty(Document.prototype, 'cookie', {
        get: () => '',
        set: () => {
          throw new Error('Cookies disabled');
        },
        configurable: true
      });

      const client = createHecateClient({ baseUrl: 'http://localhost:4000' });
      const visitorId = client.getVisitorId();
      expect(localStorage.getItem('hecate_visitor_id')).toBe(visitorId);
      expect(client.persistedVia).toBe('localstorage');
    });

    it('should fall back to in-memory if cookies and localStorage are unavailable', () => {
      // Mock cookie block
      Object.defineProperty(Document.prototype, 'cookie', {
        get: () => '',
        set: () => {
          throw new Error('Cookies disabled');
        },
        configurable: true
      });
      // Mock localStorage block
      Object.defineProperty(window, 'localStorage', {
        get: () => {
          throw new Error('Storage disabled');
        },
        configurable: true
      });

      const client = createHecateClient({ baseUrl: 'http://localhost:4000' });
      const visitorId = client.getVisitorId();
      expect(visitorId).toBeDefined();
      expect(client.persistedVia).toBe('memory');
    });

    it('should use explicitly supplied visitorId when provided', () => {
      const client = createHecateClient({ baseUrl: 'http://localhost:4000', visitorId: 'custom-visitor-123' });
      expect(client.getVisitorId()).toBe('custom-visitor-123');
      expect(document.cookie).toContain('hecate_visitor_id=custom-visitor-123');
    });

    it('should deterministically reuse visitorId stored in cookies', () => {
      document.cookie = 'hecate_visitor_id=stored-visitor-abc; path=/';
      const client1 = createHecateClient({ baseUrl: 'http://localhost:4000' });
      expect(client1.getVisitorId()).toBe('stored-visitor-abc');

      const client2 = createHecateClient({ baseUrl: 'http://localhost:4000' });
      expect(client2.getVisitorId()).toBe('stored-visitor-abc');
    });

    it('should deterministically reuse visitorId stored in localStorage if cookies fail', () => {
      // Mock cookie block
      Object.defineProperty(Document.prototype, 'cookie', {
        get: () => '',
        set: () => {},
        configurable: true
      });
      
      localStorage.setItem('hecate_visitor_id', 'stored-local-visitor-xyz');

      const client = createHecateClient({ baseUrl: 'http://localhost:4000' });
      expect(client.getVisitorId()).toBe('stored-local-visitor-xyz');
    });
  });

  describe('Assignment Caching and Requests', () => {
    it('should make network request for assignments and cache them', async () => {
      mockFetchResponse(200, {
        assignments: [
          { experimentKey: 'homepage_hero', variantKey: 'treatment' }
        ],
        errors: []
      });

      const client = createHecateClient({ baseUrl: 'http://localhost:4000', visitorId: 'visitor_1' });

      // First fetch
      const result = await client.getAssignments(['homepage_hero']);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(result).toEqual([{ experimentKey: 'homepage_hero', variantKey: 'treatment' }]);
      expect(client.getVariant('homepage_hero')).toBe('treatment');

      // Second fetch (should be served from cache)
      const result2 = await client.getAssignments(['homepage_hero']);
      expect(global.fetch).toHaveBeenCalledTimes(1); // Still 1 call
      expect(result2).toEqual([{ experimentKey: 'homepage_hero', variantKey: 'treatment' }]);
    });

    it('should support multiple experiment keys and fetch only missing ones', async () => {
      mockFetchResponse(200, {
        assignments: [
          { experimentKey: 'homepage_hero', variantKey: 'treatment' },
          { experimentKey: 'checkout_button_text', variantKey: 'control' }
        ],
        errors: []
      });

      const client = createHecateClient({ baseUrl: 'http://localhost:4000', visitorId: 'visitor_1' });

      // Fetch both keys
      await client.getAssignments(['homepage_hero', 'checkout_button_text']);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(requestBody.experimentKeys).toEqual(['homepage_hero', 'checkout_button_text']);

      // Call again with one cached and one new key
      mockFetchResponse(200, {
        assignments: [
          { experimentKey: 'new_experiment', variantKey: 'variant_a' }
        ],
        errors: []
      });

      await client.getAssignments(['homepage_hero', 'new_experiment']);
      expect(global.fetch).toHaveBeenCalledTimes(2);

      const secondRequestBody = JSON.parse(global.fetch.mock.calls[1][1].body);
      expect(secondRequestBody.experimentKeys).toEqual(['new_experiment']); // Only requests the missing one
    });

    it('should preserve partial assignments and trigger onError callback for errors', async () => {
      mockFetchResponse(200, {
        assignments: [
          { experimentKey: 'homepage_hero', variantKey: 'treatment' }
        ],
        errors: [
          { experimentKey: 'checkout_button_text', reason: 'experiment_not_active' }
        ]
      });

      const onErrorMock = jest.fn();
      const client = createHecateClient({
        baseUrl: 'http://localhost:4000',
        visitorId: 'visitor_1',
        onError: onErrorMock
      });

      const result = await client.getAssignments(['homepage_hero', 'checkout_button_text']);
      expect(result).toEqual([
        { experimentKey: 'homepage_hero', variantKey: 'treatment' },
        { experimentKey: 'checkout_button_text', variantKey: undefined }
      ]);

      expect(client.getVariant('homepage_hero')).toBe('treatment');
      expect(client.getVariant('checkout_button_text')).toBe('control'); // Falls back to default 'control'

      expect(onErrorMock).toHaveBeenCalledTimes(1);
      expect(onErrorMock.mock.calls[0][0].message).toContain('checkout_button_text');
      expect(onErrorMock.mock.calls[0][1]).toEqual({
        experimentKey: 'checkout_button_text',
        reason: 'experiment_not_active'
      });
    });

    it('should return configured fallback variant when assignment fails or times out', async () => {
      global.fetch.mockImplementation(() => Promise.reject(new Error('Network Down')));

      const onErrorMock = jest.fn();
      const client = createHecateClient({
        baseUrl: 'http://localhost:4000',
        visitorId: 'visitor_1',
        onError: onErrorMock
      });

      const result = await client.getAssignments(['homepage_hero']);
      expect(result).toEqual([{ experimentKey: 'homepage_hero', variantKey: undefined }]);
      expect(client.getVariant('homepage_hero', 'custom_fallback')).toBe('custom_fallback');
      expect(onErrorMock).toHaveBeenCalledTimes(1);
    });

    it('should clear assignments from memory cache on clearAssignments()', async () => {
      mockFetchResponse(200, {
        assignments: [{ experimentKey: 'homepage_hero', variantKey: 'treatment' }],
        errors: []
      });

      const client = createHecateClient({ baseUrl: 'http://localhost:4000', visitorId: 'visitor_1' });
      await client.getAssignments(['homepage_hero']);
      expect(client.getVariant('homepage_hero')).toBe('treatment');

      client.clearAssignments();
      expect(client.getVariant('homepage_hero')).toBe('control'); // Cleared, back to fallback
    });
  });

  describe('Exposure Tracking', () => {
    it('should not record exposure automatically during assignment request', async () => {
      mockFetchResponse(200, {
        assignments: [{ experimentKey: 'homepage_hero', variantKey: 'treatment' }],
        errors: []
      });

      const client = createHecateClient({ baseUrl: 'http://localhost:4000', visitorId: 'visitor_1' });
      await client.getAssignments(['homepage_hero']);

      // Fetch should only have been called for assignments
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch.mock.calls[0][0]).toContain('/assignments');
    });

    it('should send exposure event after explicit trackExposure() call', async () => {
      mockFetchResponse(200, {
        assignments: [{ experimentKey: 'homepage_hero', variantKey: 'treatment' }],
        errors: []
      });

      const client = createHecateClient({ baseUrl: 'http://localhost:4000', visitorId: 'visitor_1' });
      await client.getAssignments(['homepage_hero']);

      mockFetchResponse(200, { status: 'success', deduped: false });
      await client.trackExposure('homepage_hero', { page: 'landing' });

      // Verification
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch.mock.calls[1][0]).toContain('/events/exposure');
      
      const payload = JSON.parse(global.fetch.mock.calls[1][1].body);
      expect(payload).toEqual({
        visitorId: 'visitor_1',
        experimentKey: 'homepage_hero',
        variantKey: 'treatment',
        occurredAt: expect.any(String),
        metadata: { page: 'landing' }
      });
    });

    it('should prevent duplicate exposure calls for the same experiment and variant', async () => {
      mockFetchResponse(200, {
        assignments: [{ experimentKey: 'homepage_hero', variantKey: 'treatment' }],
        errors: []
      });

      const client = createHecateClient({ baseUrl: 'http://localhost:4000', visitorId: 'visitor_1' });
      await client.getAssignments(['homepage_hero']);

      mockFetchResponse(200, { status: 'success', deduped: false });
      
      // Call twice
      await client.trackExposure('homepage_hero');
      await client.trackExposure('homepage_hero');

      // Check fetch calls: 1 for assignments, 1 for exposure (deduplicated the second)
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should reject exposure tracking locally when no assignment exists', async () => {
      const onErrorMock = jest.fn();
      const client = createHecateClient({
        baseUrl: 'http://localhost:4000',
        visitorId: 'visitor_1',
        onError: onErrorMock
      });

      await client.trackExposure('homepage_hero');
      
      expect(global.fetch).not.toHaveBeenCalled();
      expect(onErrorMock).toHaveBeenCalledTimes(1);
      expect(onErrorMock.mock.calls[0][0].message).toContain('no assignment cached');
    });
  });

  describe('Telemetry Event Tracking', () => {
    it('should construct and send telemetry payload correctly', async () => {
      mockFetchResponse(200, {
        assignments: [{ experimentKey: 'homepage_hero', variantKey: 'treatment' }],
        errors: []
      });

      const client = createHecateClient({ baseUrl: 'http://localhost:4000', visitorId: 'visitor_1' });
      await client.getAssignments(['homepage_hero']);

      mockFetchResponse(200, { status: 'success', deduped: false });
      await client.trackTelemetry({
        experimentKey: 'homepage_hero',
        eventType: 'conversion',
        eventName: 'order_placed',
        metadata: { value: 99.99 }
      });

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch.mock.calls[1][0]).toContain('/events/telemetry');

      const payload = JSON.parse(global.fetch.mock.calls[1][1].body);
      expect(payload).toEqual({
        visitorId: 'visitor_1',
        experimentKey: 'homepage_hero',
        eventType: 'conversion',
        eventName: 'order_placed',
        occurredAt: expect.any(String),
        metadata: { value: 99.99 }
      });
      expect(payload.variantKey).toBeUndefined();
    });

    it('should reject telemetry tracking locally when no assignment exists', async () => {
      const onErrorMock = jest.fn();
      const client = createHecateClient({
        baseUrl: 'http://localhost:4000',
        visitorId: 'visitor_1',
        onError: onErrorMock
      });

      await client.trackTelemetry({
        experimentKey: 'homepage_hero',
        eventType: 'conversion',
        eventName: 'order_placed'
      });

      expect(global.fetch).not.toHaveBeenCalled();
      expect(onErrorMock).toHaveBeenCalledTimes(1);
      expect(onErrorMock.mock.calls[0][0].message).toContain('no assignment cached');
    });
  });

  describe('Network and Request Settings', () => {
    it('should abort requests and handle timeouts gracefully', async () => {
      // Mock delayed response
      global.fetch.mockImplementation((url, options) => {
        const signal = options.signal;
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            resolve({ ok: true, json: () => Promise.resolve({}) });
          }, 2000);
          
          if (signal) {
            signal.addEventListener('abort', () => {
              clearTimeout(timeout);
              const err = new Error('The user aborted a request.');
              err.name = 'AbortError';
              reject(err);
            });
          }
        });
      });

      const onErrorMock = jest.fn();
      const client = createHecateClient({
        baseUrl: 'http://localhost:4000',
        visitorId: 'visitor_1',
        requestTimeoutMs: 100, // Timeout after 100ms
        onError: onErrorMock
      });

      const assignmentsPromise = client.getAssignments(['homepage_hero']);
      
      // Fast-forward timers to trigger abort
      jest.advanceTimersByTime(150);

      await assignmentsPromise;

      expect(onErrorMock).toHaveBeenCalledTimes(1);
      expect(onErrorMock.mock.calls[0][0].name).toBe('AbortError');
    });

    it('should include x-api-key header only when supplied', async () => {
      mockFetchResponse(200, { assignments: [], errors: [] });

      const clientWithKey = createHecateClient({
        baseUrl: 'http://localhost:4000',
        apiKey: 'secure-api-key-123'
      });
      await clientWithKey.getAssignments(['homepage_hero']);
      expect(global.fetch.mock.calls[0][1].headers['x-api-key']).toBe('secure-api-key-123');

      const clientWithoutKey = createHecateClient({
        baseUrl: 'http://localhost:4000'
      });
      await clientWithoutKey.getAssignments(['homepage_hero']);
      expect(global.fetch.mock.calls[1][1].headers['x-api-key']).toBeUndefined();
    });

    it('should retry exposure and conversion once for network errors or HTTP 5xx', async () => {
      // Setup: Cache assignment first
      mockFetchResponse(200, {
        assignments: [{ experimentKey: 'homepage_hero', variantKey: 'treatment' }],
        errors: []
      });
      const client = createHecateClient({ baseUrl: 'http://localhost:4000', visitorId: 'visitor_1' });
      await client.getAssignments(['homepage_hero']);

      // 1. Exposure Retry (First call fails, second call succeeds)
      global.fetch
        .mockImplementationOnce(() => Promise.reject(new TypeError('Failed to fetch')))
        .mockImplementationOnce(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'success' }) }));

      await client.trackExposure('homepage_hero');
      expect(global.fetch).toHaveBeenCalledTimes(3); // 1 assignment, 2 exposure attempts

      // 2. Conversion Retry (First call HTTP 500, second call HTTP 200)
      global.fetch
        .mockImplementationOnce(() => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) }))
        .mockImplementationOnce(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'success' }) }));

      await client.trackTelemetry({
        experimentKey: 'homepage_hero',
        eventType: 'conversion',
        eventName: 'order_placed'
      });
      expect(global.fetch).toHaveBeenCalledTimes(5); // 3 + 2 telemetry attempts
    });

    it('should not retry exposure/conversions for HTTP 4xx or general telemetry events', async () => {
      // Cache assignment
      mockFetchResponse(200, {
        assignments: [{ experimentKey: 'homepage_hero', variantKey: 'treatment' }],
        errors: []
      });
      const client = createHecateClient({ baseUrl: 'http://localhost:4000', visitorId: 'visitor_1' });
      await client.getAssignments(['homepage_hero']);

      // 1. HTTP 400 bad request (No retry)
      global.fetch.mockImplementationOnce(() =>
        Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({}) })
      );
      await client.trackExposure('homepage_hero');
      expect(global.fetch).toHaveBeenCalledTimes(2); // 1 assignment, 1 exposure (no retry)

      // 2. General telemetry event with 500 error (No retry)
      global.fetch.mockImplementationOnce(() =>
        Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) })
      );
      await client.trackTelemetry({
        experimentKey: 'homepage_hero',
        eventType: 'commerce', // not conversion
        eventName: 'add_to_cart'
      });
      expect(global.fetch).toHaveBeenCalledTimes(3); // 2 + 1 telemetry (no retry)
    });

    it('sends assignment_mismatch and exposure_not_found responses to onError without retrying', async () => {
      mockFetchResponse(200, { assignments: [{ experimentKey: 'homepage_hero', variantKey: 'treatment' }], errors: [] });
      const onErrorMock = jest.fn();
      const client = createHecateClient({ baseUrl: 'http://localhost:4000', visitorId: 'visitor_1', onError: onErrorMock });
      await client.getAssignments(['homepage_hero']);

      global.fetch.mockImplementationOnce(() => Promise.resolve({ ok: false, status: 409, json: () => Promise.resolve({ error_code: 'assignment_mismatch' }) }));
      await client.trackExposure('homepage_hero');
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(onErrorMock.mock.calls[0][0].errorCode).toBe('assignment_mismatch');

      global.fetch.mockImplementationOnce(() => Promise.resolve({ ok: false, status: 409, json: () => Promise.resolve({ error_code: 'exposure_not_found' }) }));
      await client.trackTelemetry({ experimentKey: 'homepage_hero', eventType: 'conversion', eventName: 'order_placed' });
      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(onErrorMock.mock.calls[1][0].errorCode).toBe('exposure_not_found');
    });
  });
});
