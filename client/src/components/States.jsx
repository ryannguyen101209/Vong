import { useI18n } from '../i18n/index.jsx';

export function EmptyState({ title, body, children }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      {body && <p>{body}</p>}
      {children && <div className="row">{children}</div>}
    </div>
  );
}

/** Placeholder posts while the feed loads. */
export function LoadingFeed({ count = 3 }) {
  const { t } = useI18n();
  return (
    <div className="skeleton-feed" aria-busy="true" aria-label={t('common.loading')}>
      {Array.from({ length: count }, (_, i) => <div className="skeleton-post" key={i}><span /></div>)}
    </div>
  );
}

export function ErrorState({ onRetry }) {
  const { t } = useI18n();
  return (
    <div className="empty" role="alert">
      <h2>{t('common.error')}</h2>
      {onRetry && (
        <div className="row">
          <button type="button" className="btn" onClick={onRetry}>{t('common.retry')}</button>
        </div>
      )}
    </div>
  );
}
