import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient, APIError } from '../src/api/client';

describe('API Client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('should send the x-api-key and Content-Type headers', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ status: 'success' }),
    });

    await apiClient.getExperiments();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/experiments'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'x-api-key': 'dev-api-key',
        }),
      })
    );
  });

  it('should handle 400 validation error', async () => {
    const errorPayload = { error_code: 'invalid_payload', message: 'Variants must total 100' };
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      headers: { get: () => 'application/json' },
      json: async () => errorPayload,
    });

    await expect(apiClient.createExperiment({})).rejects.toThrowError(
      new APIError('Variants must total 100', 400, 'invalid_payload', errorPayload)
    );
  });

  it('should handle 401 unauthorized error', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: { get: () => 'application/json' },
      json: async () => ({ error_code: 'unauthorized', message: 'Invalid API key' }),
    });

    await expect(apiClient.getExperiments()).rejects.toThrowError(
      new APIError('Missing or invalid API key.', 401, 'unauthorized')
    );
  });

  it('should handle 404 not found error', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: { get: () => 'application/json' },
      json: async () => ({ error_code: 'experiment_not_found', message: 'Not found' }),
    });

    await expect(apiClient.getExperiment('unknown')).rejects.toThrowError(
      new APIError('Experiment or resource not found.', 404, 'not_found')
    );
  });

  it('should handle 409 duplicate key error', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      headers: { get: () => 'application/json' },
      json: async () => ({ error_code: 'duplicate_experiment_key', message: 'Duplicate' }),
    });

    await expect(apiClient.createExperiment({ key: 'existing' })).rejects.toThrowError(
      new APIError('Experiment with this key already exists.', 409, 'duplicate_key')
    );
  });

  it('should handle 500 server error', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: { get: () => 'application/json' },
      json: async () => ({ error_code: 'server_error', message: 'Internal Server Error' }),
    });

    await expect(apiClient.getExperiments()).rejects.toThrowError(
      new APIError('Internal server error occurred.', 500, 'server_error')
    );
  });

  it('should handle network failures', async () => {
    fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(apiClient.getExperiments()).rejects.toThrowError(
      new APIError('Network error or connection failed.', 0, 'network_failure')
    );
  });

  it('should handle request timeout', async () => {
    const abortError = new Error('The user aborted a request.');
    abortError.name = 'AbortError';
    fetch.mockRejectedValueOnce(abortError);

    await expect(apiClient.getExperiments()).rejects.toThrowError(
      new APIError('Request timed out.', 408, 'timeout')
    );
  });

  it('should call activateExperiment successfully', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ status: 'success' }),
    });

    await apiClient.activateExperiment('my_exp');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/experiments/my_exp/activate'),
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('should call deactivateExperiment successfully', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ status: 'success' }),
    });

    await apiClient.deactivateExperiment('my_exp');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/experiments/my_exp/deactivate'),
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('should call deleteExperiment successfully', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ status: 'success' }),
    });

    await apiClient.deleteExperiment('my_exp');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/experiments/my_exp'),
      expect.objectContaining({
        method: 'DELETE',
      })
    );
  });
});
