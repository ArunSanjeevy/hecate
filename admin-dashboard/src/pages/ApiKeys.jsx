import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, KeyRound, Trash2 } from 'lucide-react';
import { apiClient } from '../api/client';
import { ErrorState, LoadingState } from '../components/States';

export default function ApiKeys() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [createdKey, setCreatedKey] = useState(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [error, setError] = useState('');
  const keys = useQuery({ queryKey: ['apiKeys'], queryFn: apiClient.getKeys });
  const create = useMutation({ mutationFn: apiClient.createKey, onSuccess: (data) => { setCreatedKey(data.key); setKeyCopied(false); setName(''); setExpiresAt(''); queryClient.invalidateQueries({ queryKey: ['apiKeys'] }); }, onError: (e) => setError(e.message) });
  const revoke = useMutation({ mutationFn: apiClient.revokeKey, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['apiKeys'] }) });
  const submit = (event) => { event.preventDefault(); setError(''); const iso = expiresAt ? new Date(`${expiresAt}T00:00:00`).toISOString() : undefined; if (expiresAt && new Date(iso) <= new Date()) return setError('Expiration must be a future date.'); create.mutate({ name, ...(iso ? { expiresAt: iso } : {}) }); };
  if (keys.isLoading) return <LoadingState message="Loading SDK keys..." />;
  if (keys.isError) return <ErrorState title="Could not load SDK keys" description={keys.error.message} onRetry={keys.refetch} />;
  const list = keys.data?.keys || [];
  return <div><h2 className="page-title">API Keys</h2><p className="page-subtitle">SDK/API keys for your applications. These are not dashboard credentials.</p>
    {createdKey && <div className="alert alert-warning"><div className="alert-message"><strong>Copy this SDK key now.</strong> It will not be shown again.<br /><code className="secret-key">{createdKey.apiKey}</code><br /><button className="btn btn-secondary btn-sm" onClick={async () => { await navigator.clipboard?.writeText(createdKey.apiKey); setKeyCopied(true); }}><Copy size={15} />{keyCopied ? 'Copied' : 'Copy key'}</button>{keyCopied && <button className="btn btn-secondary btn-sm" style={{ marginLeft: '.5rem' }} onClick={() => setCreatedKey(null)}>Close</button>}</div></div>}
    <form className="panel-card" onSubmit={submit}><h3 className="chart-title"><KeyRound size={20} />Create SDK key</h3>{error && <p className="form-error">{error}</p>}
      <div className="key-form"><div className="form-group"><label className="form-label" htmlFor="key-name">Name</label><input id="key-name" className="form-input" value={name} onChange={(e) => setName(e.target.value)} required /></div><div className="form-group"><label className="form-label" htmlFor="key-expiry">Expiration (optional)</label><input id="key-expiry" className="form-input" type="date" value={expiresAt} min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)} onChange={(e) => setExpiresAt(e.target.value)} /></div><button className="btn btn-primary" disabled={create.isPending}>{create.isPending ? 'Creating...' : 'Create key'}</button></div>
    </form>
    <div className="table-container"><table className="data-table"><thead><tr><th>Name</th><th>Key</th><th>Expires</th><th>Created</th><th /></tr></thead><tbody>{list.map((key) => <tr key={key.id}><td>{key.name}</td><td><code>{key.apiKey}</code></td><td>{key.expiresAt ? new Date(key.expiresAt).toLocaleDateString() : 'Never'}</td><td>{key.createdAt ? new Date(key.createdAt).toLocaleDateString() : '—'}</td><td><button className="btn btn-danger btn-sm" onClick={() => window.confirm(`Revoke “${key.name}”? This cannot be undone.`) && revoke.mutate(key.id)} disabled={revoke.isPending}><Trash2 size={15} />Revoke</button></td></tr>)}</tbody></table></div>
  </div>;
}
