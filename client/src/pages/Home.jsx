import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { api } from '../lib/api.js';
import { ListingCard } from '../components/ListingCard.jsx';
import { LoadingGrid } from '../components/States.jsx';
import { ArrowUpRightIcon } from '../components/Icons.jsx';

const storyCards = [
  { category: 'electronics', image: '/vong-higgsfield-camera.webp' },
  { category: 'clothing', image: '/vong-higgsfield-clothing.webp' },
  { category: 'furniture', image: '/vong-higgsfield-chair.webp', featured: true },
  { category: 'books', image: '/vong-higgsfield-books.webp' },
  { category: 'household', image: '/vong-higgsfield-household.webp' },
];

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
    const storyFrame = root.querySelector('.scroll-story__frame');
    const storyPhone = root.querySelector('.scroll-story__phone');
    const storyIntro = root.querySelector('.scroll-story__intro');
    const parallaxCopy = [...root.querySelectorAll('[data-parallax]')];
    let frame = 0;

    const smoothStep = (start, end, value) => {
      const progress = Math.min(1, Math.max(0, (value - start) / (end - start)));
      return progress * progress * (3 - 2 * progress);
    };

    const updateMotion = () => {
      frame = 0;
      const scrollRange = document.documentElement.scrollHeight - window.innerHeight;
      const pageProgress = scrollRange > 0 ? window.scrollY / scrollRange : 0;
      progress.style.transform = `scaleX(${Math.min(1, Math.max(0, pageProgress))})`;

      const storyRect = story.getBoundingClientRect();
      const storyRange = Math.max(1, storyRect.height - window.innerHeight);
      const storyProgress = Math.min(1, Math.max(0, -storyRect.top / storyRange));
      const introExit = smoothStep(0.1, 0.17, storyProgress);
      const cardsReveal = smoothStep(0.18, 0.25, storyProgress);
      const selectProgress = smoothStep(0.23, 0.4, storyProgress);
      const zoomProgress = smoothStep(0.43, 0.68, storyProgress);
      const phoneProgress = smoothStep(0.69, 0.84, storyProgress);
      const activeStep = storyProgress < 0.23 ? -1 : storyProgress < 0.43 ? 0 : storyProgress < 0.69 ? 1 : storyProgress < 0.85 ? 2 : 3;
      storySteps.forEach((item, index) => item.classList.toggle('is-active', index === activeStep));
      storyDots.forEach((item, index) => item.classList.toggle('is-active', index === activeStep));
      storyCards.style.opacity = `${cardsReveal * (1 - zoomProgress * 0.78)}`;
      storyCards.style.transform = `translate3d(calc(-50% + ${(1 - selectProgress) * 18}vw), -50%, 0)`;
      storyFrame.style.opacity = `${smoothStep(0.43, 0.5, storyProgress)}`;
      storyFrame.style.transform = `translate3d(-50%, -50%, 0) scale(${0.27 + zoomProgress * 0.73})`;
      storyPhone.style.opacity = `${phoneProgress}`;
      storyPhone.style.transform = `translate3d(-50%, calc(-50% + ${(1 - phoneProgress) * 24}%), 0) scale(${0.92 + phoneProgress * 0.08})`;
      storyIntro.style.opacity = `${1 - introExit}`;
      storyIntro.style.transform = `translate3d(0, ${introExit * -18}%, 0)`;
      if (storyProgress >= 0.56 && storyProgress < 0.99) {
        if (storyVideo.paused) storyVideo.play().catch(() => {});
      } else {
        if (!storyVideo.paused) storyVideo.pause();
        if (storyProgress < 0.56 && storyVideo.currentTime > 0.02) storyVideo.currentTime = 0;
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
              loop
              aria-label={t('home.heroImageAlt')}
            >
              <source src="/vong-higgsfield-chair-film.mp4" type="video/mp4" />
            </video>
          </div>

          <div className="scroll-story__phone" aria-hidden="true">
            <span className="scroll-story__phone-notch" />
            <span className="scroll-story__phone-brand">Vòng</span>
            <span className="scroll-story__phone-action">
              {t('home.storyMessageSeller')} <ArrowUpRightIcon size={15} />
            </span>
          </div>

          <div className="scroll-story__copy">
            {[1, 2, 3, 4].map((number) => (
              <div className="scroll-story__step" data-story-step key={number}>
                <span>0{number}</span>
                <p>{t(`home.storyStep${number}`)}</p>
              </div>
            ))}
          </div>

          <div className="scroll-story__cards" aria-hidden="true">
            {storyCards.map((card) => (
              <figure className={`scroll-story__card${card.featured ? ' is-featured' : ''}`} key={card.category}>
                <figcaption>{t(`categories.${card.category}`)}</figcaption>
                <img src={card.image} alt="" />
              </figure>
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
