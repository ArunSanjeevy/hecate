const API_URL = import.meta.env.VITE_HECATE_API_URL;

let authToken = null;
let unauthorizedHandler = null;

export class APIError extends Error {
  constructor(message, status, errorCode, details = null) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.errorCode = errorCode;
    this.details = details;
  }
}

export function setAuthToken(token) {
  authToken = token || null;
}

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

async function request(path, options = {}) {
  if (!API_URL) {
    throw new APIError('API Configuration (URL) is missing.', 0, 'missing_config');
  }

  const url = `${API_URL.replace(/\/$/, '')}${path}`;
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (options.auth !== false && authToken) headers.Authorization = `Bearer ${authToken}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || 10000);
  try {
    const response = await fetch(url, { ...options, headers, signal: controller.signal });
    clearTimeout(timeoutId);
    const contentType = response.headers.get('content-type');
    const data = contentType?.includes('application/json') ? await response.json() : null;

    if (!response.ok) {
      const message = data?.message || data?.error_message || response.statusText || 'An error occurred';
      if (response.status === 401) {
        if (options.auth !== false) unauthorizedHandler?.();
        throw new APIError(options.auth === false ? message : 'Your session has expired. Please log in again.', 401, 'unauthorized', data);
      }
      if (response.status === 400) throw new APIError(message, 400, 'invalid_payload', data);
      if (response.status === 429) throw new APIError(message || 'Too many requests. Please wait and try again.', 429, 'rate_limit_exceeded', data);
      if (response.status === 404) throw new APIError('Experiment or resource not found.', 404, 'not_found', data);
      if (response.status === 409) throw new APIError(message, 409, 'conflict', data);
      if (response.status >= 500) throw new APIError('Internal server error occurred.', response.status, 'server_error', data);
      throw new APIError(message, response.status, data?.error_code || 'unknown_error', data);
    }
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'APIError') throw error;
    if (error.name === 'AbortError') throw new APIError('Request timed out.', 408, 'timeout');
    throw new APIError('Network error or connection failed.', 0, 'network_failure');
  }
}

function buildQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

export const apiClient = {
  signup: (payload) => request('/api/v1/auth/signup', { method: 'POST', body: JSON.stringify(payload), auth: false }),
  login: (payload) => request('/api/v1/auth/login', { method: 'POST', body: JSON.stringify(payload), auth: false }),
  getExperiments: (params) => request(`/api/v1/experiments${buildQuery(params)}`),
  getExperiment: (key) => request(`/api/v1/experiments/${encodeURIComponent(key)}`),
  createExperiment: (payload) => request('/api/v1/experiments', { method: 'POST', body: JSON.stringify(payload) }),
  updateExperiment: (key, payload) => request(`/api/v1/experiments/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify(payload) }),
  getResults: (key) => request(`/api/v1/results/${encodeURIComponent(key)}`),
  activateExperiment: (key) => request(`/api/v1/experiments/${encodeURIComponent(key)}/activate`, { method: 'POST' }),
  deactivateExperiment: (key) => request(`/api/v1/experiments/${encodeURIComponent(key)}/deactivate`, { method: 'POST' }),
  deleteExperiment: (key) => request(`/api/v1/experiments/${encodeURIComponent(key)}`, { method: 'DELETE' }),
  getKeys: (params) => request(`/api/v1/keys${buildQuery(params)}`),
  createKey: (payload) => request('/api/v1/keys', { method: 'POST', body: JSON.stringify(payload) }),
  revokeKey: (id) => request(`/api/v1/keys/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
