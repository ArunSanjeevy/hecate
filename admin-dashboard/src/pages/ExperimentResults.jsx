import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, RefreshCw, BarChart2, Eye, Award, CheckCircle } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { apiClient } from '../api/client';
import { LoadingState, ErrorState } from '../components/States';

export default function ExperimentResults() {
  const { key } = useParams();

  // Query 1: Fetch experiment details (for status)
  const experimentQuery = useQuery({
    queryKey: ['experiment', key],
    queryFn: () => apiClient.getExperiment(key),
    retry: false
  });

  // Query 2: Fetch results
  const resultsQuery = useQuery({
    queryKey: ['results', key],
    queryFn: () => apiClient.getResults(key),
    retry: false
  });

  const handleRefresh = () => {
    experimentQuery.refetch();
    resultsQuery.refetch();
  };

  const isLoading = experimentQuery.isLoading || resultsQuery.isLoading;
  const isError = experimentQuery.isError || resultsQuery.isError;
  const error = experimentQuery.error || resultsQuery.error;

  if (isLoading) return <LoadingState message="Loading experiment results..." />;
  if (isError) {
    return (
      <ErrorState 
        title="Failed to Load Results" 
        description={error?.message || 'We could not fetch the analysis results.'}
        onRetry={handleRefresh}
      />
    );
  }

  const status = experimentQuery.data?.status || 'unknown';
  const resultsData = resultsQuery.data || { experimentKey: key, variants: [] };
  const variants = resultsData.variants || [];

  // Calculate summary metrics
  const totalExposures = variants.reduce((sum, v) => sum + (v.exposures || 0), 0);
  const totalConversions = variants.reduce((sum, v) => sum + (v.conversions || 0), 0);
  const overallConversionRate = totalExposures > 0 ? (totalConversions / totalExposures) : 0;

  // Format percent helper
  const formatPercent = (val) => `${(val * 100).toFixed(2)}%`;

  // Recharts color list for variants
  const colors = ['#6366f1', '#a855f7', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444'];

  // Prepare chart data (scaling conversion rate to percent for the Y axis)
  const chartData = variants.map((v) => ({
    name: v.variantKey,
    rate: Number((v.conversionRate * 100).toFixed(2)),
    rateRaw: v.conversionRate
  }));

  return (
    <div>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to={`/experiments/${encodeURIComponent(key)}`} className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', gap: '0.25rem' }}>
          <ArrowLeft size={16} />
          <span>Back to Details</span>
        </Link>
        
        <button 
          className="btn btn-secondary btn-sm" 
          onClick={handleRefresh}
          style={{ display: 'inline-flex', gap: '0.25rem' }}
          data-testid="refresh-btn"
        >
          <RefreshCw size={16} />
          <span>Refresh Results</span>
        </button>
      </div>

      <div className="action-header">
        <div>
          <h2 className="page-title">Results: {key}</h2>
          <p className="page-subtitle">
            Current Status: <span className={`badge ${status}`} style={{ verticalAlign: 'middle', marginLeft: '0.5rem' }}>{status}</span>
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="metrics-grid">
        <div className="metric-card" data-testid="metric-total-exposures">
          <div className="metric-icon-wrapper" style={{ color: 'var(--accent-primary)' }}>
            <Eye size={20} />
          </div>
          <span className="metric-label">Total Exposures</span>
          <span className="metric-value">{totalExposures}</span>
        </div>

        <div className="metric-card" data-testid="metric-total-conversions">
          <div className="metric-icon-wrapper" style={{ color: 'var(--accent-secondary)' }}>
            <Award size={20} />
          </div>
          <span className="metric-label">Total Conversions</span>
          <span className="metric-value">{totalConversions}</span>
        </div>

        <div className="metric-card" data-testid="metric-overall-cr">
          <div className="metric-icon-wrapper" style={{ color: 'var(--success-color)' }}>
            <CheckCircle size={20} />
          </div>
          <span className="metric-label">Overall Conversion Rate</span>
          <span className="metric-value">{formatPercent(overallConversionRate)}</span>
        </div>
      </div>

      {/* Grid: Table & Chart */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', marginTop: '2rem' }}>
        {/* Table Card */}
        <div className="panel-card" style={{ margin: 0 }}>
          <h3 className="chart-title">
            <BarChart2 size={18} />
            <span>Variant Comparison Table</span>
          </h3>
          <div className="table-container">
            <table className="data-table" data-testid="results-table">
              <thead>
                <tr>
                  <th>Variant Key</th>
                  <th>Exposures</th>
                  <th>Conversions</th>
                  <th>Conversion Rate</th>
                </tr>
              </thead>
              <tbody>
                {variants.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      No variants registered.
                    </td>
                  </tr>
                ) : (
                  variants.map((v) => (
                    <tr key={v.variantKey} data-testid={`result-row-${v.variantKey}`}>
                      <td style={{ fontWeight: 600 }}>{v.variantKey}</td>
                      <td>{v.exposures}</td>
                      <td>{v.conversions}</td>
                      <td style={{ fontWeight: 600, color: 'var(--success-color)' }}>
                        {formatPercent(v.conversionRate)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Chart Card */}
        <div className="chart-card" style={{ margin: 0 }}>
          <h3 className="chart-title">
            <BarChart2 size={18} />
            <span>Conversion Rate By Variant (%)</span>
          </h3>
          {totalExposures === 0 ? (
            <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
              No exposure events recorded yet. Ready to receive assignments.
            </div>
          ) : (
            <div className="chart-container" data-testid="results-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="var(--text-secondary)" tickLine={false} />
                  <YAxis stroke="var(--text-secondary)" tickLine={false} unit="%" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--bg-secondary)', 
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-primary)'
                    }} 
                    formatter={(value) => [`${value}%`, 'Conversion Rate']}
                  />
                  <Bar dataKey="rate" radius={[4, 4, 0, 0]} barSize={50}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
