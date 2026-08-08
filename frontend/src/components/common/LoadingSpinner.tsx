import React from 'react';

export const LoadingSpinner: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => {
  return (
    <div className="spinner-wrapper" role="status" aria-live="polite">
      <div className="loading-spinner"></div>
      {message && <p className="spinner-message">{message}</p>}
    </div>
  );
};

export const LoadingSkeleton: React.FC<{ rows?: number }> = ({ rows = 3 }) => {
  return (
    <div className="skeleton-wrapper" aria-hidden="true">
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="skeleton-card">
          <div className="skeleton-line skeleton-title"></div>
          <div className="skeleton-line skeleton-body-short"></div>
          <div className="skeleton-line skeleton-body-long"></div>
        </div>
      ))}
    </div>
  );
};
