import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { api } from '../lib/api.js';
import { formatPrice } from '../lib/format.js';
import { ListingCard } from '../components/ListingCard.jsx';
import { LoadingGrid } from '../components/States.jsx';
import { LogoMark } from '../components/Logo.jsx';

export function Home() {
  const { t, lang } = useI18n();
  const [listings, setListings] = useState([]);
  const [fee, setFee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([api.listings({ sort: 'newest' }), api.meta()])
      .then(([listed, meta]) => {
        if (!active) return;
        setListings(listed.listings.slice(0, 4));
        setTotal(listed.listings.length);
        setFee(meta.fee_vnd);
      })
      .catch(() => {
        /* The hero and the rest of the page still work without data. */
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const steps = [1, 2, 3].map((n) => ({
    n,
    title: t(`home.step${n}Title`),
    body: t(`home.step${n}Body`),
  }));

  return (
    <>
      <section className="shell hero">
        <div className="hero__grid">
          <div>
            <p className="eyebrow">{t('home.heroEyebrow')}</p>
            <h1 className="hero__title">{t('home.heroTitle')}</h1>
            <p className="lead">{t('home.heroLead')}</p>

            <div className="hero__actions">
              <Link to="/sell" className="btn btn--accent">{t('home.heroCtaPrimary')}</Link>
              <Link to="/browse" className="btn btn--ghost">{t('home.heroCtaSecondary')}</Link>
            </div>

            <div className="hero__stats">
              <div>
                <span className="hero__stat-value">{total ?? '—'}</span>
                <span className="hero__stat-label">{t('home.heroStatListings')}</span>
              </div>
              <div>
                <span className="hero__stat-value">{fee == null ? '—' : formatPrice(fee, lang)}</span>
                <span className="hero__stat-label">{t('home.heroStatFee')}</span>
              </div>
              <div>
                <span className="hero__stat-value">0%</span>
                <span className="hero__stat-label">{t('home.heroStatCut')}</span>
              </div>
            </div>
          </div>

          <div className="hero__art">
            <LogoMark size={340} />
          </div>
        </div>
      </section>

      <section className="section section--sunk">
        <div className="shell">
          <div className="section-head">
            <p className="eyebrow">{t('home.stepsTitle')}</p>
            <h2>{t('home.stepsLead')}</h2>
          </div>

          <div className="steps">
            {steps.map((step) => (
              <article className="card step" key={step.n}>
                <div className="step__number">{String(step.n).padStart(2, '0')}</div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section shell">
        <div className="spread section-head" style={{ maxWidth: 'none' }}>
          <div>
            <h2 style={{ marginBottom: 6 }}>{t('home.recentTitle')}</h2>
            <p className="muted">{t('home.recentLead')}</p>
          </div>
          <Link to="/browse" className="btn btn--ghost btn--small">{t('home.recentViewAll')}</Link>
        </div>

        {loading ? (
          <LoadingGrid count={4} />
        ) : (
          <div className="grid-listings">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </section>

      <section className="section--tight shell">
        <div className="card panel" style={{ maxWidth: '76ch' }}>
          <p className="eyebrow">{t('home.promiseTitle')}</p>
          <p className="lead" style={{ color: 'var(--ink)' }}>{t('home.promiseBody')}</p>
        </div>
      </section>

      <section className="section shell">
        <div className="cta-band">
          <h2>{t('home.ctaTitle')}</h2>
          <p>{t('home.ctaBody')}</p>
          <Link to="/sell" className="btn">{t('home.ctaButton')}</Link>
        </div>
      </section>
    </>
  );
}
