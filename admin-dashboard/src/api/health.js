const API_URL = import.meta.env.VITE_HECATE_API_URL || 'http://localhost:4000';

async function fetchHealth(path) {
  const response = await fetch(`${API_URL.replace(/\/$/, '')}${path}`, {
    method: 'GET',
    headers: { Accept: 'application/json' }
  });
  const payload = await response.json().catch(() => null);
  return { ok: response.ok, payload };
}

export async function getLivenessStatus() {
  try {
    const { ok, payload } = await fetchHealth('/health/live');
    return ok && (payload?.status === 'ok' || payload?.status === 'shutting_down') ? 'online' : 'offline';
  } catch {
    return 'offline';
  }
}

export async function getReadinessStatus() {
  try {
    const { ok, payload } = await fetchHealth('/health/ready');
    if (!ok || payload?.status !== 'ready') return 'not ready';
    return payload?.dependencies?.redis === 'degraded' ? 'degraded' : 'ready';
  } catch {
    return 'offline';
  }
}
