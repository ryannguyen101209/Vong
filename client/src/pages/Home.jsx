import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { api } from '../lib/api.js';
import { formatPrice } from '../lib/format.js';
import { ListingCard } from '../components/ListingCard.jsx';
import { LoadingGrid } from '../components/States.jsx';
import { ListingImage } from '../components/ListingCard.jsx';
import { ArrowUpRightIcon, CheckIcon, MessageIcon, UploadIcon } from '../components/Icons.jsx';

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
          <div className="hero__copy reveal-on-scroll">
            <p className="eyebrow">{t('home.heroEyebrow')}</p>
            <h1 className="hero__title">{t('home.heroTitle')}</h1>
            <p className="lead">{t('home.heroLead')}</p>

            <div className="hero__actions">
              <Link to="/sell" className="btn btn--accent">
                {t('home.heroCtaPrimary')} <span className="btn__icon"><ArrowUpRightIcon /></span>
              </Link>
              <Link to="/browse" className="btn btn--ghost">{t('home.heroCtaSecondary')}</Link>
            </div>

            <div className="hero__stats">
              <div>
                <span className="hero__stat-value">{total ?? '-'}</span>
                <span className="hero__stat-label">{t('home.heroStatListings')}</span>
              </div>
              <div>
                <span className="hero__stat-value">{fee == null ? '-' : formatPrice(fee, lang)}</span>
                <span className="hero__stat-label">{t('home.heroStatFee')}</span>
              </div>
              <div>
                <span className="hero__stat-value">0%</span>
                <span className="hero__stat-label">{t('home.heroStatCut')}</span>
              </div>
            </div>
          </div>

          <div className="hero__market reveal-on-scroll" aria-label={t('home.heroVisualLabel')}>
            {listings.slice(0, 3).map((listing, index) => (
              <Link to={`/listing/${listing.id}`} className={`hero-product hero-product--${index + 1}`} key={listing.id}>
                <ListingImage listing={listing} alt={localizedTitle(listing, lang)} />
                <span>{formatPrice(listing.price_vnd, lang)}</span>
              </Link>
            ))}
            {listings.length === 0 && (
              <>
                <div className="hero-product hero-product--1 hero-product--placeholder" />
                <div className="hero-product hero-product--2 hero-product--placeholder" />
                <div className="hero-product hero-product--3 hero-product--placeholder" />
              </>
            )}
            <div className="hero-fee-note"><CheckIcon /> {t('home.heroFeeNote', { fee: fee == null ? '10,000₫' : formatPrice(fee, lang) })}</div>
          </div>
        </div>
      </section>

      <section className="section process-section">
        <div className="shell">
          <div className="section-head reveal-on-scroll">
            <h2>{t('home.stepsLead')}</h2>
          </div>

          <div className="steps-flow">
            {steps.map((step, index) => (
              <article className={`step-flow step-flow--${index + 1} reveal-on-scroll`} key={step.n}>
                <div className="step-flow__icon">{index === 0 ? <UploadIcon /> : index === 1 ? <CheckIcon /> : <MessageIcon />}</div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section shell reveal-on-scroll">
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
          <div className="grid-listings grid-listings--editorial">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </section>

      <section className="section--tight shell reveal-on-scroll">
        <div className="trust-statement">
          <MessageIcon size={32} />
          <div>
            <h2>{t('home.promiseTitle')}</h2>
            <p>{t('home.promiseBody')}</p>
          </div>
        </div>
      </section>

      <section className="section shell reveal-on-scroll">
        <div className="cta-band">
          <h2>{t('home.ctaTitle')}</h2>
          <p>{t('home.ctaBody')}</p>
          <Link to="/sell" className="btn">{t('home.ctaButton')} <span className="btn__icon"><ArrowUpRightIcon /></span></Link>
        </div>
      </section>
    </>
  );
}

function localizedTitle(listing, lang) {
  return listing[`title_${lang}`] || listing.title_en || listing.title_vi || '';
}
