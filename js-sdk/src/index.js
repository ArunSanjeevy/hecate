/**
 * Hecate Browser JavaScript SDK
 */

function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback UUID v4 generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function getCookie(name) {
  if (typeof document === 'undefined') return null;
  try {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return decodeURIComponent(parts.pop().split(';').shift() || '');
    }
  } catch (e) {
    // Cookies blocked or disabled
  }
  return null;
}

function setCookie(name, value) {
  if (typeof document === 'undefined') return false;
  try {
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 1); // 1 year expiry
    let cookieStr = `${name}=${encodeURIComponent(value)}; expires=${expiry.toUTCString()}; path=/; SameSite=Lax`;
    if (typeof window !== 'undefined' && window.location && window.location.protocol === 'https:') {
      cookieStr += '; Secure';
    }
    document.cookie = cookieStr;
    // Verify it was actually written
    return getCookie(name) === value;
  } catch (e) {
    return false;
  }
}

function getLocalStorage(key) {
  try {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined' || window.localStorage === null) return null;
    return window.localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

function setLocalStorage(key, value) {
  try {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined' || window.localStorage === null) return false;
    window.localStorage.setItem(key, value);
    return true;
  } catch (e) {
    return false;
  }
}

class HecateClient {
  constructor({ baseUrl, apiKey, visitorId, requestTimeoutMs, onError } = {}) {
    this.baseUrl = baseUrl || '';
    if (this.baseUrl.endsWith('/')) {
      this.baseUrl = this.baseUrl.slice(0, -1);
    }
    this.apiKey = apiKey;
    this.requestTimeoutMs = requestTimeoutMs;
    this.onError = onError;

    this.assignments = {};
    this.exposures = new Set();

    // Resolve visitorId
    let resolvedId = visitorId;
    if (!resolvedId) {
      resolvedId = getCookie('hecate_visitor_id');
    }
    if (!resolvedId) {
      resolvedId = getLocalStorage('hecate_visitor_id');
    }
    if (!resolvedId) {
      resolvedId = generateUUID();
    }

    // Persist visitorId
    let persistedVia = 'memory';
    if (setCookie('hecate_visitor_id', resolvedId)) {
      persistedVia = 'cookie';
    } else if (setLocalStorage('hecate_visitor_id', resolvedId)) {
      persistedVia = 'localstorage';
    }

    this.visitorId = resolvedId;
    this.persistedVia = persistedVia;
  }

  getVisitorId() {
    return this.visitorId;
  }

  clearAssignments() {
    this.assignments = {};
    this.exposures.clear();
  }

  _handleError(error, context = {}) {
    if (typeof this.onError === 'function') {
      try {
        this.onError(error, context);
      } catch (e) {
        console.error('Error in Hecate client onError callback:', e);
      }
    }
  }

  async _fetchWithTimeout(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const signal = controller.signal;

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    }

    let timeoutId;
    if (this.requestTimeoutMs && this.requestTimeoutMs > 0) {
      timeoutId = setTimeout(() => {
        controller.abort();
      }, this.requestTimeoutMs);
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal
      });

      if (timeoutId) clearTimeout(timeoutId);

      if (!response.ok) {
        const err = new Error(`Request failed with status ${response.status}`);
        err.status = response.status;
        throw err;
      }

      return await response.json();
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      throw err;
    }
  }

  async _fetchWithRetry(path, options, shouldRetry) {
    try {
      return await this._fetchWithTimeout(path, options);
    } catch (err) {
      const isNetworkError = err.name === 'TypeError' || err.message.includes('fetch') || err.name === 'AbortError';
      const isHttp5xx = err.status >= 500 && err.status < 600;

      if (!shouldRetry || (!isNetworkError && !isHttp5xx)) {
        throw err;
      }

      // Retry exactly once
      return await this._fetchWithTimeout(path, options);
    }
  }

  async getAssignments(experimentKeys) {
    if (!Array.isArray(experimentKeys) || experimentKeys.length === 0) {
      return [];
    }

    const missingKeys = experimentKeys.filter(key => !(key in this.assignments));

    if (missingKeys.length === 0) {
      return experimentKeys.map(key => ({
        experimentKey: key,
        variantKey: this.assignments[key]
      }));
    }

    try {
      const response = await this._fetchWithTimeout('/api/v1/assignments', {
        method: 'POST',
        body: JSON.stringify({
          visitorId: this.visitorId,
          experimentKeys: missingKeys
        })
      });

      if (response && Array.isArray(response.assignments)) {
        response.assignments.forEach(item => {
          this.assignments[item.experimentKey] = item.variantKey;
        });
      }

      if (response && Array.isArray(response.errors) && response.errors.length > 0) {
        response.errors.forEach(err => {
          this._handleError(new Error(`Assignment error for ${err.experimentKey}: ${err.reason}`), {
            experimentKey: err.experimentKey,
            reason: err.reason
          });
        });
      }
    } catch (err) {
      this._handleError(err, { type: 'assignment_request_failed', keys: missingKeys });
    }

    return experimentKeys.map(key => ({
      experimentKey: key,
      variantKey: this.assignments[key]
    }));
  }

  getVariant(experimentKey, fallbackVariant = 'control') {
    if (experimentKey in this.assignments) {
      return this.assignments[experimentKey];
    }
    return fallbackVariant;
  }

  trackExposure(experimentKey, metadata = {}) {
    const variantKey = this.assignments[experimentKey];
    if (!variantKey) {
      this._handleError(new Error(`Cannot track exposure: no assignment cached for experiment '${experimentKey}'`));
      return Promise.resolve();
    }

    const exposureKey = `${experimentKey}:${variantKey}`;
    if (this.exposures.has(exposureKey)) {
      return Promise.resolve();
    }

    this.exposures.add(exposureKey);

    const payload = {
      visitorId: this.visitorId,
      experimentKey,
      variantKey,
      occurredAt: new Date().toISOString(),
      metadata
    };

    return this._fetchWithRetry('/api/v1/events/exposure', {
      method: 'POST',
      body: JSON.stringify(payload)
    }, true).catch(err => {
      this._handleError(err, { type: 'exposure_tracking_failed', experimentKey, variantKey });
    });
  }

  trackTelemetry({ experimentKey, eventType, eventName, metadata = {} }) {
    const variantKey = this.assignments[experimentKey];
    if (!variantKey) {
      this._handleError(new Error(`Cannot track telemetry: no assignment cached for experiment '${experimentKey}'`));
      return Promise.resolve();
    }

    const payload = {
      visitorId: this.visitorId,
      experimentKey,
      variantKey,
      eventType,
      eventName,
      occurredAt: new Date().toISOString(),
      metadata
    };

    const shouldRetry = eventType === 'conversion';

    return this._fetchWithRetry('/api/v1/events/telemetry', {
      method: 'POST',
      body: JSON.stringify(payload)
    }, shouldRetry).catch(err => {
      this._handleError(err, { type: 'telemetry_tracking_failed', experimentKey, eventType, eventName });
    });
  }
}

export function createHecateClient(config) {
  return new HecateClient(config);
}
