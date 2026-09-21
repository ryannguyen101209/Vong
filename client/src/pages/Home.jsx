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
    const hero = root.querySelector('.poster-hero');
    const heroTop = root.querySelector('.poster-hero__word--top');
    const heroBottom = root.querySelector('.poster-hero__word--bottom');
    const heroImage = root.querySelector('.poster-hero__cluster');
    const heroOrbits = [...root.querySelectorAll('[data-hero-orbit]')];
    const parallaxCopy = [...root.querySelectorAll('[data-parallax]')];
    let frame = 0;

    const updateMotion = () => {
      frame = 0;
      const scrollRange = document.documentElement.scrollHeight - window.innerHeight;
      const pageProgress = scrollRange > 0 ? window.scrollY / scrollRange : 0;
      progress.style.transform = `scaleX(${Math.min(1, Math.max(0, pageProgress))})`;

      const heroRect = hero.getBoundingClientRect();
      const heroTravel = Math.min(1, Math.max(0, -heroRect.top / heroRect.height));
      heroTop.style.transform = `translate3d(${heroTravel * 9}vw, 0, 0)`;
      heroBottom.style.transform = `translate3d(${-heroTravel * 8}vw, 0, 0)`;
      heroImage.style.transform = `translate3d(-50%, calc(-50% - ${heroTravel * 7}vh), 0) rotate(${heroTravel * 2.5}deg) scale(${1 + heroTravel * 0.08})`;
      heroOrbits.forEach((item, index) => {
        const direction = index % 2 === 0 ? 1 : -1;
        item.style.transform = `translate3d(0, ${heroTravel * direction * 9}vh, 0) rotate(${heroTravel * direction * 10}deg)`;
      });

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
      <section className="poster-hero" aria-labelledby="poster-hero-title">
        <div className="poster-hero__masthead">
          <span>{t('home.posterMarket')}</span>
          <span>Saigon — 2026</span>
          <span>{total ?? 0} {t('home.heroStatListings')}</span>
        </div>

        <div className="poster-hero__word poster-hero__word--top" aria-hidden="true">
          {t('home.heroWordTop')}
        </div>
        <figure className="poster-hero__art" aria-hidden="true">
          <span className="poster-hero__halo" />
          <img className="poster-hero__cluster" src="/vong-higgsfield-resale-cluster.webp" alt="" />
          <img className="poster-hero__orbit poster-hero__orbit--camera" data-hero-orbit src="/vong-higgsfield-camera.webp" alt="" />
          <img className="poster-hero__orbit poster-hero__orbit--tote" data-hero-orbit src="/vong-higgsfield-tote.webp" alt="" />
          <span className="poster-hero__dot poster-hero__dot--one" />
          <span className="poster-hero__dot poster-hero__dot--two" />
        </figure>
        <h1 id="poster-hero-title" className="sr-only">{t('home.heroTitle')}</h1>
        <div className="poster-hero__word poster-hero__word--bottom" aria-hidden="true">
          {t('home.heroWordBottom')}
        </div>

        <div className="poster-hero__vertical poster-hero__vertical--left">
          <span>{t('home.heroLocation')}</span>
          <span>{t('home.heroEdition')}</span>
        </div>
        <div className="poster-hero__vertical poster-hero__vertical--right">
          <span>{t('home.posterCycle')}</span>
          <span>{t('home.posterKeepMoving')}</span>
        </div>

        <div className="poster-hero__message">
          <span>01 — {t('home.posterLoop')}</span>
          <p>{t('home.heroLeadShort')}</p>
        </div>

        <div className="poster-hero__footer">
          <Link to="/browse" className="poster-hero__primary">
            <span>{t('home.heroCtaSecondary')}</span>
            <ArrowUpRightIcon size={24} />
          </Link>
          <Link to="/sell" className="poster-hero__secondary">
            <span>{t('home.heroCtaPrimary')}</span>
            <ArrowUpRightIcon size={24} />
          </Link>
          <div className="poster-hero__facts">
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
