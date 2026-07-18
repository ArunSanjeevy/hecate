import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, PlusCircle, Eye, BarChart2 } from 'lucide-react';
import { apiClient } from '../api/client';
import { LoadingState, ErrorState, EmptyState } from '../components/States';

export default function ExperimentList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['experiments'],
    queryFn: apiClient.getExperiments,
  });

  if (isLoading) return <LoadingState message="Loading experiments list..." />;
  if (error) {
    return (
      <ErrorState 
        title="Failed to Load Experiments" 
        description={error.message || 'There was an error communicating with the backend.'}
        onRetry={refetch}
      />
    );
  }

  const experiments = data?.experiments || [];

  if (experiments.length === 0) {
    return (
      <EmptyState 
        title="No Experiments Found"
        description="Get started by creating your first experiment configuration."
        action={
          <Link to="/experiments/new" className="btn btn-primary">
            <PlusCircle size={18} />
            <span>Create Experiment</span>
          </Link>
        }
      />
    );
  }

  // Client-side filtering
  const filtered = experiments.filter(e => {
    const keyMatch = e.key.toLowerCase().includes(searchTerm.toLowerCase());
    const statusMatch = statusFilter ? e.status === statusFilter : true;
    return keyMatch && statusMatch;
  });

  return (
    <div>
      <div className="action-header">
        <div>
          <h2 className="page-title">Experiments</h2>
          <p className="page-subtitle">Configure, allocate, and monitor experiment variables</p>
        </div>
        <Link to="/experiments/new" className="btn btn-primary">
          <PlusCircle size={18} />
          <span>Create Experiment</span>
        </Link>
      </div>

      {/* Filters Section */}
      <div className="panel-card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div className="filters-bar">
          <div className="filter-input-wrapper" style={{ position: 'relative' }}>
            <Search 
              size={18} 
              style={{ 
                position: 'absolute', 
                left: '12px', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                color: 'var(--text-muted)' 
              }} 
            />
            <input
              type="text"
              placeholder="Filter by experiment key..."
              className="form-input"
              style={{ paddingLeft: '2.5rem' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="search-input"
            />
          </div>
          <div className="filter-select-wrapper">
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              data-testid="status-select"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table list */}
      {filtered.length === 0 ? (
        <div className="state-container" style={{ minHeight: '200px' }}>
          <p className="state-description">No experiments matched your filter criteria.</p>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => { setSearchTerm(''); setStatusFilter(''); }}
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table" data-testid="experiments-table">
            <thead>
              <tr>
                <th>Experiment Key</th>
                <th>Status</th>
                <th>Salt</th>
                <th>Variants</th>
                <th>Allocation Summary</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const variantCount = e.variants?.length || 0;
                const allocationSummary = e.variants
                  ?.map(v => `${v.key} (${v.allocation}%)`)
                  .join(' / ') || 'None';

                return (
                  <tr key={e.key} data-testid={`experiment-row-${e.key}`}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {e.key}
                    </td>
                    <td>
                      <span className={`badge ${e.status}`}>
                        {e.status}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                      {e.salt}
                    </td>
                    <td>{variantCount}</td>
                    <td style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      {allocationSummary}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Link 
                          to={`/experiments/${e.key}`} 
                          className="btn btn-primary btn-sm"
                          style={{ padding: '0.375rem 0.75rem', display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}
                          title="View experiment details"
                          data-testid={`view-btn-${e.key}`}
                        >
                          <Eye size={14} />
                          <span>View</span>
                        </Link>
                        <Link 
                          to={`/experiments/${e.key}/results`} 
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.375rem 0.75rem', display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}
                          title="View analytics results"
                          data-testid={`results-btn-${e.key}`}
                        >
                          <BarChart2 size={14} />
                          <span>Results</span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
