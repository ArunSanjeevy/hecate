import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, KeyRound, Trash2 } from 'lucide-react';
import { apiClient } from '../api/client';
import { ErrorState, LoadingState } from '../components/States';

const durationLimits = { hour: 8760, day: 365, week: 52, month: 12, year: 1 };

const getExpiryIso = (amount, unit) => {
  const expiresAt = new Date();
  const numericAmount = Number(amount);
  if (unit === 'hour') expiresAt.setHours(expiresAt.getHours() + numericAmount);
  if (unit === 'day') expiresAt.setDate(expiresAt.getDate() + numericAmount);
  if (unit === 'week') expiresAt.setDate(expiresAt.getDate() + (numericAmount * 7));
  if (unit === 'month') expiresAt.setMonth(expiresAt.getMonth() + numericAmount);
  if (unit === 'year') expiresAt.setFullYear(expiresAt.getFullYear() + numericAmount);
  return expiresAt.toISOString();
};

export default function ApiKeys() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('1');
  const [durationUnit, setDurationUnit] = useState('day');
  const [createdKey, setCreatedKey] = useState(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [error, setError] = useState('');
  const keys = useQuery({ queryKey: ['apiKeys'], queryFn: apiClient.getKeys });
  const create = useMutation({ mutationFn: apiClient.createKey, onSuccess: (data) => { setCreatedKey(data.key); setKeyCopied(false); setName(''); setDuration('1'); setDurationUnit('day'); queryClient.invalidateQueries({ queryKey: ['apiKeys'] }); }, onError: (e) => setError(e.message) });
  const revoke = useMutation({ mutationFn: apiClient.revokeKey, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['apiKeys'] }) });
  const submit = (event) => {
    event.preventDefault();
    setError('');
    const amount = Number(duration);
    if (!Number.isInteger(amount) || amount < 1 || amount > durationLimits[durationUnit]) {
      setError(`Enter a whole number from 1 to ${durationLimits[durationUnit]} ${durationUnit}${durationLimits[durationUnit] === 1 ? '' : 's'}.`);
      return;
    }
    create.mutate({ name, expiresAt: getExpiryIso(amount, durationUnit) });
  };
  if (keys.isLoading) return <LoadingState message="Loading SDK keys..." />;
  if (keys.isError) return <ErrorState title="Could not load SDK keys" description={keys.error.message} onRetry={keys.refetch} />;
  const list = keys.data?.keys || [];
  return <div><h2 className="page-title">API Keys</h2><p className="page-subtitle">SDK/API keys for your applications. These are not dashboard credentials.</p>
    {createdKey && <div className="alert alert-warning"><div className="alert-message"><strong>Copy this SDK key now.</strong> It will not be shown again.<br /><code className="secret-key">{createdKey.apiKey}</code><br /><button className="btn btn-secondary btn-sm" onClick={async () => { await navigator.clipboard?.writeText(createdKey.apiKey); setKeyCopied(true); }}><Copy size={15} />{keyCopied ? 'Copied' : 'Copy key'}</button>{keyCopied && <button className="btn btn-secondary btn-sm" style={{ marginLeft: '.5rem' }} onClick={() => setCreatedKey(null)}>Close</button>}</div></div>}
    <form className="panel-card" onSubmit={submit}><h3 className="chart-title"><KeyRound size={20} />Create SDK key</h3>{error && <p className="form-error">{error}</p>}
      <div className="key-form"><div className="form-group"><label className="form-label" htmlFor="key-name">Name</label><input id="key-name" className="form-input" value={name} onChange={(e) => setName(e.target.value)} required /></div><div className="form-group"><label className="form-label" htmlFor="key-duration">Expiration duration</label><input id="key-duration" className="form-input" type="number" min="1" max={durationLimits[durationUnit]} step="1" value={duration} onChange={(e) => setDuration(e.target.value)} required /></div><div className="form-group"><label className="form-label" htmlFor="key-duration-unit">Expiration unit</label><select id="key-duration-unit" className="form-select" value={durationUnit} onChange={(e) => { setDurationUnit(e.target.value); setDuration('1'); }}><option value="hour">Hours</option><option value="day">Days</option><option value="week">Weeks</option><option value="month">Months</option><option value="year">Years</option></select></div><button className="btn btn-primary" disabled={create.isPending}>{create.isPending ? 'Creating...' : 'Create key'}</button></div>
    </form>
    <div className="table-container"><table className="data-table"><thead><tr><th>Name</th><th>Key</th><th>Expires</th><th>Created</th><th /></tr></thead><tbody>{list.map((key) => <tr key={key.id}><td>{key.name}</td><td><code>{key.apiKey}</code></td><td>{key.expiresAt ? new Date(key.expiresAt).toLocaleDateString() : '—'}</td><td>{key.createdAt ? new Date(key.createdAt).toLocaleDateString() : '—'}</td><td><button className="btn btn-danger btn-sm" onClick={() => window.confirm(`Revoke “${key.name}”? This cannot be undone.`) && revoke.mutate(key.id)} disabled={revoke.isPending}><Trash2 size={15} />Revoke</button></td></tr>)}</tbody></table></div>
  </div>;
}
