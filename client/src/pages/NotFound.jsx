import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';

export function NotFound() {
  const { t } = useI18n();
  return (
    <div className="info info--lost">
      <div className="shell info__col empty">
        <h1>{t('notFound.title')}</h1>
        <p>{t('notFound.body')}</p>
        <div className="row">
          <Link to="/browse" className="btn btn--primary">{t('nav.browse')}</Link>
        </div>
      </div>
    </div>
  );
}
