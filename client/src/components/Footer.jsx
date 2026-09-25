import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { Logo } from './Logo.jsx';

export function Footer() {
  const { t } = useI18n();
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="shell footer__inner">
        <div className="footer__about">
          <Link to="/" className="brand" aria-label={t('common.appName')}><Logo size={24} /></Link>
          <p>{t('footer.blurb')}</p>
        </div>
        <nav aria-label={t('footer.linksLabel')}>
          <ul className="footer__links">
            <li><Link to="/browse">{t('nav.browse')}</Link></li>
            <li><Link to="/sell">{t('nav.sell')}</Link></li>
            <li><Link to="/saved">{t('nav.saved')}</Link></li>
            <li><Link to="/about">{t('nav.about')}</Link></li>
            <li><Link to="/faq">{t('nav.faq')}</Link></li>
            <li><Link to="/contact">{t('nav.contact')}</Link></li>
            <li><Link to="/admin">{t('nav.admin')}</Link></li>
          </ul>
        </nav>
      </div>
      <div className="shell footer__legal">
        <p>{t('footer.legalBody')} © {year} {t('common.appName')}</p>
      </div>
    </footer>
  );
}
