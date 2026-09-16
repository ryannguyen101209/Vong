import { useI18n } from '../i18n/index.jsx';
import { BoxIcon } from './Icons.jsx';

export function EmptyState({ title, body, children }) {
  return (
    <div className="empty-state">
      <BoxIcon />
      <h3>{title}</h3>
      {body && <p className="lead" style={{ marginInline: 'auto' }}>{body}</p>}
      {children && <div className="row" style={{ justifyContent: 'center', marginTop: 20 }}>{children}</div>}
    </div>
  );
}

export function LoadingGrid({ count = 8 }) {
  return (
    <div className="skeleton-grid" aria-busy="true">
      {Array.from({ length: count }, (_, i) => <div className="skeleton" key={i} />)}
    </div>
  );
}

export function ErrorState({ onRetry }) {
  const { t } = useI18n();
  return (
    <div className="empty-state">
      <h3>{t('common.error')}</h3>
      {onRetry && (
        <button type="button" className="btn btn--ghost" onClick={onRetry} style={{ marginTop: 16 }}>
          {t('common.retry')}
        </button>
      )}
    </div>
  );
}
