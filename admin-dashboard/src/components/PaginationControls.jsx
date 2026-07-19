import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function PaginationControls({ pagination, onPageChange, isFetching = false }) {
  if (!pagination) return null;

  const { limit, offset, total, hasMore } = pagination;
  const page = Math.floor(offset / limit) + 1;
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const start = total === 0 ? 0 : offset + 1;
  const end = Math.min(offset + limit, total);
  const canGoBack = offset > 0;

  return (
    <div className="pagination-bar">
      <span className="pagination-summary">
        Showing {start}-{end} of {total}
      </span>
      <div className="pagination-actions">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={!canGoBack || isFetching}
          onClick={() => onPageChange(Math.max(0, offset - limit))}
        >
          <ChevronLeft size={15} />
          Previous
        </button>
        <span className="pagination-page">Page {page} of {pageCount}</span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={!hasMore || isFetching}
          onClick={() => onPageChange(offset + limit)}
        >
          Next
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
