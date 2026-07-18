import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient, APIError, setAuthToken, setUnauthorizedHandler } from '../src/api/client';

const jsonResponse = (data, status = 200) => ({ ok: status < 400, status, statusText: '', headers: { get: () => 'application/json' }, json: async () => data });

describe('API Client', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); setAuthToken(null); });

  it('sends a bearer token, never an API key, to control-plane routes', async () => {
    setAuthToken('user-jwt');
    fetch.mockResolvedValueOnce(jsonResponse({ experiments: [] }));
    await apiClient.getExperiments();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/v1/experiments'), expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer user-jwt', 'Content-Type': 'application/json' }) }));
    expect(fetch.mock.calls[0][1].headers).not.toHaveProperty('x-api-key');
  });

  it('does not add authorization to login', async () => {
    setAuthToken('old-token');
    fetch.mockResolvedValueOnce(jsonResponse({ token: 'new-token' }));
    await apiClient.login({ email: 'me@example.com', password: 'password123' });
    expect(fetch.mock.calls[0][1].headers).not.toHaveProperty('Authorization');
  });

  it('handles backend validation and expiration errors', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ message: 'Invalid payload' }, 400));
    await expect(apiClient.createExperiment({})).rejects.toMatchObject({ message: 'Invalid payload', status: 400, errorCode: 'invalid_payload' });
    const expireSession = vi.fn();
    setUnauthorizedHandler(expireSession);
    setAuthToken('expired');
    fetch.mockResolvedValueOnce(jsonResponse({ message: 'Expired' }, 401));
    await expect(apiClient.getExperiments()).rejects.toMatchObject({ message: 'Your session has expired. Please log in again.', status: 401, errorCode: 'unauthorized' });
    expect(expireSession).toHaveBeenCalledOnce();
  });

  it('manages SDK keys with the authenticated API', async () => {
    setAuthToken('user-jwt');
    fetch.mockResolvedValueOnce(jsonResponse({ keys: [] }));
    await apiClient.getKeys();
    fetch.mockResolvedValueOnce(jsonResponse({ key: { id: '1', apiKey: 'hk_secret' } }, 201));
    await apiClient.createKey({ name: 'Staging' });
    fetch.mockResolvedValueOnce(jsonResponse({ status: 'success' }));
    await apiClient.revokeKey('1');
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(expect.arrayContaining([expect.stringContaining('/api/v1/keys'), expect.stringContaining('/api/v1/keys/1')]));
  });
});
