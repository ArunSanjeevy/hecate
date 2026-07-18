import React from 'react';
import { AlertCircle, FolderOpen, RefreshCcw } from 'lucide-react';

export function LoadingState({ message = 'Loading details...' }) {
  return (
    <div className="state-container">
      <div className="loading-spinner" data-testid="loading-spinner" />
      <p className="state-description" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
        {message}
      </p>
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', description = 'We couldn\'t load the requested data.', onRetry }) {
  return (
    <div className="state-container">
      <div className="state-icon-wrapper" style={{ color: 'var(--danger-color)' }}>
        <AlertCircle size={48} />
      </div>
      <h3 className="state-title">{title}</h3>
      <p className="state-description">{description}</p>
      {onRetry && (
        <button className="btn btn-secondary btn-sm" onClick={onRetry}>
          <RefreshCcw size={16} />
          <span>Retry Request</span>
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title = 'No experiments found', description = 'Get started by creating your first experiment.', action }) {
  return (
    <div className="state-container">
      <div className="state-icon-wrapper">
        <FolderOpen size={48} />
      </div>
      <h3 className="state-title">{title}</h3>
      <p className="state-description">{description}</p>
      {action}
    </div>
  );
}
