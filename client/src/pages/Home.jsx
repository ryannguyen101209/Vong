import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { api } from '../lib/api.js';
import { ListingCard } from '../components/ListingCard.jsx';
import { EmptyState, ErrorState, LoadingGrid } from '../components/States.jsx';
import { ArrowUpRightIcon, SearchIcon } from '../components/Icons.jsx';

// Product photos for the categories that have one; the rest get a text tile.
const CATEGORY_PHOTOS = {
  furniture: '/vong-higgsfield-chair.webp',
  clothing: '/vong-higgsfield-clothing.webp',
  electronics: '/vong-higgsfield-camera.webp',
  books: '/vong-higgsfield-books.webp',
  household: '/vong-higgsfield-household.webp',
  // Unsplash License (free to use, no attribution required), cropped and warmed to match:
  // images.unsplash.com/photo-1600185365483-26d7a4cc7519 and images.unsplash.com/photo-1556449895-a33c9dba33dd
  sports: '/vong-unsplash-sports.webp',
  hobby: '/vong-unsplash-hobby.webp',
};

/**
 * Full-screen greeting on a still photo. Where the browser supports
 * scroll-linked animation, the photo stays pinned and the greeting pops up as
 * the visitor scrolls (all in styles.css); elsewhere it is simply shown.
 */
function Welcome() {
  const { t } = useI18n();
  return (
    <div className="welcome-scroll">
      <section className="welcome" aria-labelledby="welcome-title">
        <img className="welcome__media" src="/vong-higgsfield-chair.webp" alt="" width="2688" height="1520" fetchPriority="high" />
        <h1 id="welcome-title" className="welcome__word">{t('home.welcomeWord')}</h1>
        <div className="welcome__bar">
          <p className="welcome__line">{t('home.welcomeLine')}</p>
          <Link to="/browse" className="welcome__cta">{t('home.heroCtaSecondary')} <ArrowUpRightIcon size={18} /></Link>
        </div>
      </section>
    </div>
  );
}

export function Home() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [listings, setListings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [status, setStatus] = useState('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    Promise.all([api.listings({ sort: 'newest' }), api.meta()])
      .then(([data, meta]) => {
        if (!active) return;
        setListings(data.listings.slice(0, 8));
        setCategories(meta.categories);
        setStatus('ready');
      })
      .catch(() => active && setStatus('error'));
    return () => { active = false; };
  }, [attempt]);

  function onSearch(event) {
    event.preventDefault();
    const query = new URLSearchParams();
    if (search.trim()) query.set('q', search.trim());
    navigate('/browse' + (query.size ? '?' + query : ''));
  }

  return (
    <>
    <Welcome />
    <div className="shell marketplace">
      <section className="market-hero" aria-labelledby="market-title">
        <div className="market-hero__copy">
          <h2 id="market-title" className="market-hero__title">
            {/* One sentence per line, so the second never breaks into an orphan word. */}
            {t('market.title').split(/(?<=[.!?])\s+/).map((sentence) => <span key={sentence} className="market-hero__line">{sentence}</span>)}
          </h2>
          <p className="lead">{t('market.lead')}</p>
          <form className="market-search" role="search" onSubmit={onSearch}>
            <SearchIcon />
            <label className="sr-only" htmlFor="market-search">{t('browse.searchLabel')}</label>
            <input id="market-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('browse.searchPlaceholder')} />
            <button type="submit" className="btn btn--accent">{t('market.search')}</button>
          </form>
        </div>
        <div className="market-hero__image">
          <img src="/vong-higgsfield-chair.webp" alt={t('market.imageAlt')} width="2688" height="1520" fetchPriority="high" />
        </div>
      </section>

      <section className="market-discover" aria-labelledby="categories-title">
        <h2 id="categories-title" className="sr-only">{t('market.categories')}</h2>
        {/* Rendered only once categories arrive: on a phone the row snaps, and a lone
            "see all" tile rendered first would stay snapped as the others load in. */}
        {categories.length > 0 && <nav className="category-tiles" aria-label={t('market.categories')}>
          {categories.map((category) => CATEGORY_PHOTOS[category] ? (
            <Link className="category-tile" key={category} to={'/browse?category=' + encodeURIComponent(category)}>
              <span className="category-tile__media"><img src={CATEGORY_PHOTOS[category]} alt="" loading="lazy" /></span>
              <span className="category-tile__label">{t('categories.' + category)}</span>
            </Link>
          ) : (
            // No photo yet: the name itself fills the tile.
            <Link className="category-tile category-tile--text" key={category} to={'/browse?category=' + encodeURIComponent(category)}>
              <span className="category-tile__media"><span>{t('categories.' + category)}</span></span>
            </Link>
          ))}
          <Link to="/browse" className="category-tile category-tile--text category-tile--all">
            <span className="category-tile__media"><span>{t('home.recentViewAll')} <ArrowUpRightIcon size={20} /></span></span>
          </Link>
        </nav>}
      </section>

      <section aria-label={t('home.recentTitle')} className="market-listings">
        {(status !== 'ready' || listings.length > 0) && <div className="market-section-head">
          <h2 id="recent-title">{t('home.recentTitle')}</h2>
          <Link to="/browse" className="market-text-link">{t('home.recentViewAll')} <ArrowUpRightIcon size={18} /></Link>
        </div>}
        {status === 'loading' && <LoadingGrid count={8} />}
        {status === 'error' && <ErrorState onRetry={() => setAttempt((value) => value + 1)} />}
        {status === 'ready' && (listings.length ? <div className="grid-listings">{listings.map((listing) => <ListingCard listing={listing} key={listing.id} />)}</div> : <EmptyState title={t('market.firstTitle')} body={t('market.firstBody')}><Link className="btn btn--accent" to="/sell">{t('market.firstCta')}</Link></EmptyState>)}
      </section>

      <section className="market-sell" aria-labelledby="sell-title">
        <div><h2 id="sell-title">{t('market.sellTitle')}</h2><p>{t('market.sellBody')}</p></div>
        <Link to="/sell" className="btn btn--accent">{t('market.sell')} <ArrowUpRightIcon size={18} /></Link>
      </section>
    </div>
    </>
  );
}
