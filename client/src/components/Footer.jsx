import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { LogoMark } from './Logo.jsx';

export function Footer() {
  const { t } = useI18n();
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="shell footer__grid">
        <div>
          <div className="row" style={{ gap: 10, marginBottom: 14 }}>
            <LogoMark size={28} />
            <span className="brand__word">{t('common.appName')}</span>
          </div>
          <p className="small muted" style={{ maxWidth: '38ch' }}>{t('footer.blurb')}</p>
        </div>

        <div>
          <p className="footer__title">{t('footer.exploreTitle')}</p>
          <div className="footer__links">
            <Link to="/browse">{t('nav.browse')}</Link>
            <Link to="/sell">{t('nav.sell')}</Link>
            <Link to="/saved">{t('nav.saved')}</Link>
          </div>
        </div>

        <div>
          <p className="footer__title">{t('footer.aboutTitle')}</p>
          <div className="footer__links">
            <Link to="/about">{t('nav.about')}</Link>
            <Link to="/faq">{t('nav.faq')}</Link>
            <Link to="/contact">{t('nav.contact')}</Link>
            <Link to="/admin">{t('nav.admin')}</Link>
          </div>
        </div>
      </div>

      <div className="shell footer__bottom">
        <span>{t('footer.legalBody')}</span>
        <span>© {year} {t('common.appName')} · {t('footer.madeIn')}</span>
      </div>
    </footer>
  );
}
