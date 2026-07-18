const API_URL = import.meta.env.VITE_HECATE_API_URL;
const API_KEY = import.meta.env.VITE_HECATE_API_KEY;

export class APIError extends Error {
  constructor(message, status, errorCode, details = null) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.errorCode = errorCode;
    this.details = details;
  }
}

async function request(path, options = {}) {
  if (!API_URL || !API_KEY) {
    throw new APIError('API Configuration (URL or Key) is missing.', 0, 'missing_config');
  }

  const url = `${API_URL.replace(/\/$/, '')}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
    ...options.headers,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || 10000);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    let data = null;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    }

    if (!response.ok) {
      const status = response.status;
      const errorCode = data?.error_code || 'unknown_error';
      const message = data?.message || response.statusText || 'An error occurred';
      
      if (status === 400) {
        throw new APIError(message, status, 'invalid_payload', data);
      } else if (status === 401) {
        throw new APIError('Missing or invalid API key.', status, 'unauthorized');
      } else if (status === 404) {
        throw new APIError('Experiment or resource not found.', status, 'not_found');
      } else if (status === 409) {
        throw new APIError('Experiment with this key already exists.', status, 'duplicate_key');
      } else if (status >= 500) {
        throw new APIError('Internal server error occurred.', status, 'server_error');
      } else {
        throw new APIError(message, status, errorCode);
      }
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'APIError') {
      throw error;
    }
    if (error.name === 'AbortError') {
      throw new APIError('Request timed out.', 408, 'timeout');
    }
    throw new APIError('Network error or connection failed.', 0, 'network_failure');
  }
}

export const apiClient = {
  getExperiments: () => request('/api/v1/experiments'),
  getExperiment: (key) => request(`/api/v1/experiments/${encodeURIComponent(key)}`),
  createExperiment: (payload) => request('/api/v1/experiments', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  updateExperiment: (key, payload) => request(`/api/v1/experiments/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }),
  getResults: (key) => request(`/api/v1/results/${encodeURIComponent(key)}`),
  activateExperiment: (key) => request(`/api/v1/experiments/${encodeURIComponent(key)}/activate`, {
    method: 'POST',
  }),
  deactivateExperiment: (key) => request(`/api/v1/experiments/${encodeURIComponent(key)}/deactivate`, {
    method: 'POST',
  }),
  deleteExperiment: (key) => request(`/api/v1/experiments/${encodeURIComponent(key)}`, {
    method: 'DELETE',
  }),
};
