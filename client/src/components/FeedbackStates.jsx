export function LoadingSkeleton({ count = 3 }) {
  return <div className="skeleton-list" aria-label="Loading content" role="status">{Array.from({ length: count }, (_, index) => <div className="skeleton-card" key={index}><span /><span /><span /></div>)}</div>;
}

export function EmptyState({ title, message, action }) {
  return <div className="empty-state"><span className="empty-mark">/</span><h2>{title}</h2><p>{message}</p>{action}</div>;
}

export function ErrorState({ message, onRetry }) {
  return <div className="error-state" role="alert"><strong>Something went wrong</strong><p>{message}</p>{onRetry && <button className="button button-secondary" type="button" onClick={onRetry}>Try again</button>}</div>;
}