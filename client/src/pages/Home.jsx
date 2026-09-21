import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { api } from '../lib/api.js';
import { formatPrice } from '../lib/format.js';
import { ListingCard } from '../components/ListingCard.jsx';
import { LoadingGrid } from '../components/States.jsx';
import { ArrowUpRightIcon } from '../components/Icons.jsx';

export function Home() {
  const { t, lang } = useI18n();
  const homeRef = useRef(null);
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

  useEffect(() => {
    const root = homeRef.current;
    if (!root) return undefined;

    const motionItems = [...root.querySelectorAll('[data-motion]')];
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion) {
      motionItems.forEach((item) => item.classList.add('is-visible'));
      return undefined;
    }

    root.classList.add('motion-ready');

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.14, rootMargin: '0px 0px -8% 0px' },
    );
    motionItems.forEach((item) => observer.observe(item));

    const progress = root.querySelector('.scroll-progress__fill');
    const hero = root.querySelector('.manifesto');
    const heroTop = root.querySelector('.manifesto__line--top');
    const heroBottom = root.querySelector('.manifesto__line--bottom');
    const heroImage = root.querySelector('.manifesto__image img');
    const parallaxCopy = [...root.querySelectorAll('[data-parallax]')];
    let frame = 0;

    const updateMotion = () => {
      frame = 0;
      const scrollRange = document.documentElement.scrollHeight - window.innerHeight;
      const pageProgress = scrollRange > 0 ? window.scrollY / scrollRange : 0;
      progress.style.transform = `scaleX(${Math.min(1, Math.max(0, pageProgress))})`;

      const heroRect = hero.getBoundingClientRect();
      const heroTravel = Math.min(1, Math.max(0, -heroRect.top / heroRect.height));
      heroTop.style.transform = `translate3d(${heroTravel * 13}vw, 0, 0)`;
      heroBottom.style.transform = `translate3d(${-heroTravel * 11}vw, 0, 0)`;
      heroImage.style.transform = `scale(${1.02 + heroTravel * 0.12})`;

      parallaxCopy.forEach((item) => {
        const rect = item.getBoundingClientRect();
        const distance = window.innerHeight / 2 - (rect.top + rect.height / 2);
        const offset = Math.max(-70, Math.min(70, distance * 0.075));
        item.style.transform = `translate3d(0, ${offset}px, 0)`;
      });
    };

    const requestMotion = () => {
      if (!frame) frame = window.requestAnimationFrame(updateMotion);
    };

    updateMotion();
    window.addEventListener('scroll', requestMotion, { passive: true });
    window.addEventListener('resize', requestMotion);

    return () => {
      observer.disconnect();
      root.classList.remove('motion-ready');
      window.removeEventListener('scroll', requestMotion);
      window.removeEventListener('resize', requestMotion);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [loading, listings.length]);

  const steps = [1, 2, 3].map((number) => ({
    number,
    title: t(`home.step${number}Title`),
    body: t(`home.step${number}Body`),
  }));

  return (
    <div className="home-landing" ref={homeRef}>
      <div className="scroll-progress" aria-hidden="true">
        <span className="scroll-progress__fill" />
      </div>
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

      <section className="home-intro motion-reveal motion-reveal--wipe" data-motion>
        <p>{t('home.introKicker')}</p>
        <h2 data-parallax>{t('home.introTitle')}</h2>
      </section>

      <div className="motion-rail" aria-hidden="true">
        <div className="motion-rail__track">
          {[0, 1].map((group) => (
            <span key={group}>
              {t('home.motionRail')} <b>↗</b> {t('home.motionRail')} <b>↗</b> {t('home.motionRail')} <b>↗</b>&nbsp;
            </span>
          ))}
        </div>
      </div>

      <section className="home-products">
        <header className="home-products__head motion-reveal" data-motion>
          <h2>{t('home.recentTitle')}</h2>
          <Link to="/browse" className="text-link">
            {t('home.recentViewAll')} <ArrowUpRightIcon />
          </Link>
        </header>
        {loading ? (
          <LoadingGrid count={4} />
        ) : listings.length > 0 ? (
          <div className="home-products__track">
            {listings.map((listing) => (
              <div className="motion-product" data-motion key={listing.id}>
                <ListingCard listing={listing} />
              </div>
            ))}
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
        <header className="home-process__head motion-reveal motion-reveal--wipe" data-motion>
          <span>{t('home.stepsTitle')}</span>
          <h2>{t('home.stepsLead')}</h2>
        </header>
        <div className="home-process__rows">
          {steps.map((step) => (
            <article className="process-row motion-row" data-motion key={step.number}>
              <span className="process-row__number">0{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-principle motion-reveal motion-reveal--wipe" data-motion>
        <p>{t('home.promiseTitle')}</p>
        <h2 data-parallax>{t('home.promiseStatement')}</h2>
        <div className="home-principle__foot">
          <p>{t('home.promiseBodyShort')}</p>
          <Link to="/about" className="text-link">
            {t('nav.about')} <ArrowUpRightIcon />
          </Link>
        </div>
      </section>

      <section className="home-close motion-reveal motion-reveal--wipe" data-motion>
        <p>{t('home.ctaBody')}</p>
        <h2 data-parallax>{t('home.ctaTitle')}</h2>
        <Link to="/sell" className="home-close__link">
          {t('home.ctaButton')} <ArrowUpRightIcon size={38} />
        </Link>
      </section>
    </div>
  );
}
