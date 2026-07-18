import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { PlusCircle, Beaker, Play, Pause, FileText, Archive, Layers } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { apiClient } from '../api/client';
import { LoadingState, ErrorState } from '../components/States';

export default function Overview() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['experiments'],
    queryFn: apiClient.getExperiments,
  });

  if (isLoading) return <LoadingState message="Loading platform overview..." />;
  if (error) {
    return (
      <ErrorState 
        title="Failed to Load Overview" 
        description={error.message || 'There was an error communicating with the backend.'}
        onRetry={refetch}
      />
    );
  }

  const experiments = data?.experiments || [];
  const totalCount = experiments.length;
  const activeCount = experiments.filter(e => e.status === 'active').length;
  const draftCount = experiments.filter(e => e.status === 'draft').length;
  const pausedCount = experiments.filter(e => e.status === 'paused').length;
  const archivedCount = experiments.filter(e => e.status === 'archived').length;
  
  const totalVariants = experiments.reduce((acc, curr) => acc + (curr.variants?.length || 0), 0);

  // Status distribution chart data
  const statusData = [
    { name: 'Active', count: activeCount, color: 'var(--success-color)' },
    { name: 'Draft', count: draftCount, color: 'var(--info-color)' },
    { name: 'Paused', count: pausedCount, color: 'var(--warning-color)' },
    { name: 'Archived', count: archivedCount, color: 'var(--text-muted)' },
  ];

  return (
    <div>
      <div className="action-header">
        <div>
          <h2 className="page-title">Platform Overview</h2>
          <p className="page-subtitle">Snapshot of experiment configurations and status distribution</p>
        </div>
        <Link to="/experiments/new" className="btn btn-primary">
          <PlusCircle size={18} />
          <span>New Experiment</span>
        </Link>
      </div>

      {/* Metrics Grid */}
      <div className="metrics-grid">
        <div className="metric-card" data-testid="metric-total">
          <div className="metric-icon-wrapper" style={{ color: 'var(--accent-primary)' }}>
            <Beaker size={20} />
          </div>
          <span className="metric-label">Total Experiments</span>
          <span className="metric-value">{totalCount}</span>
        </div>

        <div className="metric-card" data-testid="metric-active">
          <div className="metric-icon-wrapper" style={{ color: 'var(--success-color)' }}>
            <Play size={20} />
          </div>
          <span className="metric-label">Active</span>
          <span className="metric-value">{activeCount}</span>
        </div>

        <div className="metric-card" data-testid="metric-paused">
          <div className="metric-icon-wrapper" style={{ color: 'var(--warning-color)' }}>
            <Pause size={20} />
          </div>
          <span className="metric-label">Paused</span>
          <span className="metric-value">{pausedCount}</span>
        </div>

        <div className="metric-card" data-testid="metric-draft">
          <div className="metric-icon-wrapper" style={{ color: 'var(--info-color)' }}>
            <FileText size={20} />
          </div>
          <span className="metric-label">Drafts</span>
          <span className="metric-value">{draftCount}</span>
        </div>

        <div className="metric-card" data-testid="metric-archived">
          <div className="metric-icon-wrapper" style={{ color: 'var(--text-muted)' }}>
            <Archive size={20} />
          </div>
          <span className="metric-label">Archived</span>
          <span className="metric-value">{archivedCount}</span>
        </div>

        <div className="metric-card" data-testid="metric-variants">
          <div className="metric-icon-wrapper" style={{ color: 'var(--accent-secondary)' }}>
            <Layers size={20} />
          </div>
          <span className="metric-label">Total Variants</span>
          <span className="metric-value">{totalVariants}</span>
        </div>
      </div>

      {/* Status Chart */}
      <div className="chart-card">
        <h3 className="chart-title">
          <Beaker size={18} />
          <span>Status Distribution</span>
        </h3>
        {totalCount === 0 ? (
          <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
            No status data available. Create an experiment first!
          </div>
        ) : (
          <div className="chart-container" data-testid="status-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="name" stroke="var(--text-secondary)" tickLine={false} />
                <YAxis stroke="var(--text-secondary)" tickLine={false} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--bg-secondary)', 
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-primary)'
                  }} 
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={50}>
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
