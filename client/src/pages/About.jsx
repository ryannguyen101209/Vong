import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { api } from '../lib/api.js';
import { formatPrice } from '../lib/format.js';
import { LogoTile } from '../components/Logo.jsx';

export function About() {
  const { t, lang } = useI18n();
  const [fee, setFee] = useState(null);

  useEffect(() => {
    api.meta().then((meta) => setFee(meta.fee_vnd)).catch(() => {});
  }, []);

  const feeLabel = fee == null ? '…' : formatPrice(fee, lang);

  return (
    <div className="shell section" style={{ maxWidth: 780 }}>
      <div className="section-head">
        <LogoTile size={64} />
        <h1 style={{ marginTop: 24 }}>{t('about.title')}</h1>
        <p className="lead">{t('about.lead')}</p>
      </div>

      <div className="prose">
        <h2>{t('about.storyTitle')}</h2>
        <p>{t('about.storyBody1')}</p>
        <p>{t('about.storyBody2')}</p>
        <p>{t('about.storyBody3')}</p>

        <h2 style={{ marginTop: '1.6em' }}>{t('about.modelTitle')}</h2>
        <p>{t('about.modelBody1', { fee: feeLabel })}</p>
        <p>{t('about.modelBody2')}</p>

        <h2 style={{ marginTop: '1.6em' }}>{t('about.teamTitle')}</h2>
        <p>{t('about.teamBody')}</p>
      </div>

      <div className="card panel" style={{ marginTop: 40 }}>
        <p className="eyebrow">{t('about.honestTitle')}</p>
        <p style={{ margin: 0 }}>{t('about.honestBody')}</p>
      </div>

      <div className="row" style={{ marginTop: 32 }}>
        <Link to="/sell" className="btn btn--accent">{t('home.heroCtaPrimary')}</Link>
        <Link to="/contact" className="btn btn--ghost">{t('nav.contact')}</Link>
      </div>
    </div>
  );
}
