import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { api } from '../lib/api.js';
import { formatPrice } from '../lib/format.js';
import { ListingCard } from '../components/ListingCard.jsx';
import { LoadingGrid } from '../components/States.jsx';
import { ArrowUpRightIcon } from '../components/Icons.jsx';

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
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const steps = [1, 2, 3].map((number) => ({
    number,
    title: t(`home.step${number}Title`),
    body: t(`home.step${number}Body`),
  }));

  return (
    <div className="home-landing">
      <section className="manifesto" aria-labelledby="manifesto-title">
        <div className="manifesto__line manifesto__line--top" aria-hidden="true">
          {t('home.heroWordTop')}
        </div>
        <figure className="manifesto__image">
          <img src="/vong-editorial-still-life.png" alt={t('home.heroImageAlt')} />
        </figure>
        <h1 id="manifesto-title" className="sr-only">{t('home.heroTitle')}</h1>
        <div className="manifesto__line manifesto__line--bottom" aria-hidden="true">
          {t('home.heroWordBottom')}
        </div>

        <div className="manifesto__side manifesto__side--left">
          <span>{t('home.heroLocation')}</span>
          <span>{t('home.heroEdition')}</span>
        </div>
        <div className="manifesto__side manifesto__side--right">
          <p>{t('home.heroLeadShort')}</p>
          <Link to="/browse" className="text-link">
            {t('home.heroCtaSecondary')} <ArrowUpRightIcon />
          </Link>
        </div>

        <div className="manifesto__footer">
          <Link to="/sell" className="manifesto__primary">
            <span>{t('home.heroCtaPrimary')}</span>
            <ArrowUpRightIcon size={24} />
          </Link>
          <div className="manifesto__facts">
            <span><strong>{total ?? 0}</strong> {t('home.heroStatListings')}</span>
            <span><strong>{fee == null ? '10,000₫' : formatPrice(fee, lang)}</strong> {t('home.heroStatFee')}</span>
            <span><strong>0%</strong> {t('home.heroStatCut')}</span>
          </div>
        </div>
      </section>

      <section className="home-intro reveal-on-scroll">
        <p>{t('home.introKicker')}</p>
        <h2>{t('home.introTitle')}</h2>
      </section>

      <section className="home-products">
        <header className="home-products__head reveal-on-scroll">
          <h2>{t('home.recentTitle')}</h2>
          <Link to="/browse" className="text-link">
            {t('home.recentViewAll')} <ArrowUpRightIcon />
          </Link>
        </header>
        {loading ? (
          <LoadingGrid count={4} />
        ) : listings.length > 0 ? (
          <div className="home-products__track">
            {listings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}
          </div>
        ) : (
          <div className="home-products__empty">
            <span>{t('home.emptyInventory')}</span>
            <Link to="/sell" className="text-link">
              {t('home.ctaButton')} <ArrowUpRightIcon />
            </Link>
          </div>
        )}
      </section>

      <section className="home-process">
        <header className="home-process__head reveal-on-scroll">
          <span>{t('home.stepsTitle')}</span>
          <h2>{t('home.stepsLead')}</h2>
        </header>
        <div className="home-process__rows">
          {steps.map((step) => (
            <article className="process-row reveal-on-scroll" key={step.number}>
              <span className="process-row__number">0{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-principle reveal-on-scroll">
        <p>{t('home.promiseTitle')}</p>
        <h2>{t('home.promiseStatement')}</h2>
        <div className="home-principle__foot">
          <p>{t('home.promiseBodyShort')}</p>
          <Link to="/about" className="text-link">
            {t('nav.about')} <ArrowUpRightIcon />
          </Link>
        </div>
      </section>

      <section className="home-close reveal-on-scroll">
        <p>{t('home.ctaBody')}</p>
        <h2>{t('home.ctaTitle')}</h2>
        <Link to="/sell" className="home-close__link">
          {t('home.ctaButton')} <ArrowUpRightIcon size={38} />
        </Link>
      </section>
    </div>
  );
}
