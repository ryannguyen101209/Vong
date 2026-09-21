import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { EmptyState } from '../components/States.jsx';

export function NotFound() {
  const { t } = useI18n();
  return (
    <div className="shell section editorial-page not-found-page">
      <EmptyState title={t('listing.notFoundTitle')} body={t('listing.notFoundBody')}>
        <Link to="/browse" className="btn">{t('nav.browse')}</Link>
      </EmptyState>
    </div>
  );
}
