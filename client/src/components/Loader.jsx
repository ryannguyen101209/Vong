import { useI18n } from '../i18n/index.jsx';
import { MARK_PATH } from './Logo.jsx';

/**
 * The Vòng mark drawing itself on a loop, over a faint outline of the whole
 * mark. Used while a page loads; index.html has the same one for first load.
 */
export function Loader() {
  const { t } = useI18n();
  const stroke = { d: MARK_PATH, pathLength: 1, strokeWidth: 13, strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <div className="vong-loader" role="status">
      <svg viewBox="0 0 200 170" fill="none" aria-hidden="true" focusable="false">
        <path className="vong-loader__track" {...stroke} />
        <path className="vong-loader__ink" {...stroke} />
      </svg>
      <p className="vong-loader__text">{t('common.loading')}</p>
    </div>
  );
}

/** A whole page that is still loading. */
export function PageLoader() {
  return <div className="shell section page-loading"><Loader /></div>;
}
