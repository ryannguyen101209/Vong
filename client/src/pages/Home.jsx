import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { api } from '../lib/api.js';
import { ListingCard } from '../components/ListingCard.jsx';
import { LoadingGrid } from '../components/States.jsx';
import { ArrowUpRightIcon } from '../components/Icons.jsx';

export function Home() {
  const { t } = useI18n();
  const homeRef = useRef(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(null);

  useEffect(() => {
    let active = true;
    api.listings({ sort: 'newest' })
      .then((listed) => {
        if (!active) return;
        setListings(listed.listings.slice(0, 4));
        setTotal(listed.listings.length);
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
    const story = root.querySelector('.scroll-story');
    const storyVideo = root.querySelector('.scroll-story__video');
    const storySteps = [...root.querySelectorAll('[data-story-step]')];
    const storyDots = [...root.querySelectorAll('.scroll-story__dots span')];
    const storyCards = root.querySelector('.scroll-story__cards');
    const parallaxCopy = [...root.querySelectorAll('[data-parallax]')];
    let frame = 0;

    const updateMotion = () => {
      frame = 0;
      const scrollRange = document.documentElement.scrollHeight - window.innerHeight;
      const pageProgress = scrollRange > 0 ? window.scrollY / scrollRange : 0;
      progress.style.transform = `scaleX(${Math.min(1, Math.max(0, pageProgress))})`;

      const storyRect = story.getBoundingClientRect();
      const storyRange = Math.max(1, storyRect.height - window.innerHeight);
      const storyProgress = Math.min(1, Math.max(0, -storyRect.top / storyRange));
      const activeStep = Math.min(storySteps.length - 1, Math.floor(storyProgress * storySteps.length));
      root.style.setProperty('--story-progress', storyProgress.toFixed(4));
      root.style.setProperty('--story-scale', Math.min(1, 0.7 + storyProgress * 0.5).toFixed(4));
      root.style.setProperty('--story-intro-opacity', Math.max(0, 1 - storyProgress * 6).toFixed(4));
      root.style.setProperty('--story-card-opacity', Math.max(0, 1 - storyProgress * 4).toFixed(4));
      storySteps.forEach((item, index) => item.classList.toggle('is-active', index === activeStep));
      storyDots.forEach((item, index) => item.classList.toggle('is-active', index === activeStep));
      storyCards.style.transform = `translate3d(calc(-50% - ${storyProgress * 38}vw), 0, 0)`;
      if (storyVideo.duration && Number.isFinite(storyVideo.duration)) {
        const targetTime = storyProgress * Math.max(0, storyVideo.duration - 0.04);
        if (Math.abs(storyVideo.currentTime - targetTime) > 0.025) storyVideo.currentTime = targetTime;
      }

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
    <div className="home-landing minimal-home" ref={homeRef}>
      <div className="scroll-progress" aria-hidden="true">
        <span className="scroll-progress__fill" />
      </div>
      <section className="scroll-story" aria-labelledby="scroll-story-title">
        <div className="scroll-story__stage">
          <header className="scroll-story__head">
            <span>{t('home.posterMarket')}</span>
            <span>{t('home.heroLocation')}</span>
            <span>{total ?? 0} {t('home.heroStatListings')}</span>
          </header>

          <div className="scroll-story__intro">
            <p>{t('home.introKicker')}</p>
            <h1 id="scroll-story-title">{t('home.storyTitle')}</h1>
          </div>

          <div className="scroll-story__frame">
            <video
              className="scroll-story__video"
              poster="/vong-higgsfield-chair.webp"
              preload="auto"
              muted
              playsInline
              aria-label={t('home.heroImageAlt')}
            >
              <source src="/vong-higgsfield-chair-film.mp4" type="video/mp4" />
            </video>
          </div>

          <div className="scroll-story__copy">
            {[1, 2, 3, 4].map((number) => (
              <div className={`scroll-story__step${number === 1 ? ' is-active' : ''}`} data-story-step key={number}>
                <span>0{number}</span>
                <p>{t(`home.storyStep${number}`)}</p>
              </div>
            ))}
          </div>

          <div className="scroll-story__cards" aria-hidden="true">
            {['electronics', 'furniture', 'clothing', 'household', 'books', 'hobby'].map((category, index) => (
              <span className={index === 1 ? 'is-featured' : ''} key={category}>{t(`categories.${category}`)}</span>
            ))}
          </div>

          <div className="scroll-story__bottom">
            <div className="scroll-story__dots" aria-hidden="true">
              {[1, 2, 3, 4].map((number) => <span className={number === 1 ? 'is-active' : ''} key={number}>0{number}</span>)}
            </div>
            <span>{t('home.storyScroll')}</span>
            <div className="scroll-story__actions">
              <Link to="/browse">{t('home.heroCtaSecondary')} <ArrowUpRightIcon /></Link>
              <Link to="/sell">{t('home.heroCtaPrimary')} <ArrowUpRightIcon /></Link>
            </div>
          </div>
        </div>
      </section>

      <section className="home-intro motion-reveal motion-reveal--wipe" data-motion>
        <p>{t('home.introKicker')}</p>
        <h2 data-parallax>{t('home.introTitle')}</h2>
      </section>

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
