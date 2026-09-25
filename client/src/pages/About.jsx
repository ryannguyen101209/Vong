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
    <div className="info">
      <div className="shell info__col">
        {/* Like a group's info screen: the mark as its picture, then the name. */}
        <div className="info__head info__head--group">
          <LogoTile size={56} className="info__mark" />
          <div className="info__intro">
            <h1>{t('about.title')}</h1>
            <p>{t('about.lead')}</p>
          </div>
        </div>

        <div className="prose">
          <section aria-labelledby="about-why">
            <h2 id="about-why">{t('about.storyTitle')}</h2>
            <p>{t('about.juneBody')}</p>
            <p>{t('about.groupsBody')}</p>
            <p>{t('about.nameBody')}</p>
          </section>

          {/* The money rule is the one thing we want every visitor to know, so it is pinned. */}
          <section className="pinned" aria-labelledby="about-money">
            <h2 id="about-money">{t('about.modelTitle')}</h2>
            <p>{t('about.feeBody', { fee: feeLabel })}</p>
            <p>{t('about.noEscrowBody')}</p>
          </section>

          <section aria-labelledby="about-team">
            <h2 id="about-team">{t('about.teamTitle')}</h2>
            <p>{t('about.teamBody')}</p>
          </section>

          <section aria-labelledby="about-missing">
            <h2 id="about-missing">{t('about.honestTitle')}</h2>
            <p>{t('about.missingBody')}</p>
          </section>
        </div>

        <div className="info__actions">
          <Link to="/sell" className="btn btn--primary">{t('home.heroCtaPrimary')}</Link>
          <Link to="/contact" className="btn">{t('nav.contact')}</Link>
        </div>
      </div>
    </div>
  );
}
