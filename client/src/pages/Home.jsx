import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { api } from '../lib/api.js';
import { ListingCard } from '../components/ListingCard.jsx';
import { EmptyState, ErrorState, LoadingGrid } from '../components/States.jsx';
import { ArrowUpRightIcon, SearchIcon } from '../components/Icons.jsx';

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
    <div className="shell marketplace">
      <section className="market-hero" aria-labelledby="market-title">
        <div className="market-hero__copy">
          <p className="eyebrow">{t('home.heroLocation')} / {t('market.eyebrow')}</p>
          <h1 id="market-title">{t('market.title')}</h1>
          <p className="lead">{t('market.lead')}</p>
          <div className="row">
            <Link to="/browse" className="btn btn--accent">{t('home.heroCtaSecondary')} <ArrowUpRightIcon size={18} /></Link>
            <Link to="/sell" className="btn btn--ghost">{t('market.sell')}</Link>
          </div>
        </div>
        <div className="market-hero__image">
          <img src="/vong-higgsfield-chair.webp" alt={t('market.imageAlt')} fetchPriority="high" />
          <span>{t('market.imageCaption')}</span>
        </div>
      </section>

      <section className="market-discover" aria-label={t('browse.searchLabel')}>
        <form className="market-search" role="search" onSubmit={onSearch}>
          <SearchIcon />
          <label className="sr-only" htmlFor="market-search">{t('browse.searchLabel')}</label>
          <input id="market-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('browse.searchPlaceholder')} />
          <button type="submit" className="btn btn--accent">{t('market.search')}</button>
        </form>
        <nav className="market-categories" aria-label={t('market.categories')}>
          <Link to="/browse" className="chip chip--active">{t('browse.allCategories')}</Link>
          {categories.map((category) => <Link className="chip" key={category} to={'/browse?category=' + encodeURIComponent(category)}>{t('categories.' + category)}</Link>)}
        </nav>
      </section>

      <section aria-labelledby="recent-title" className="market-listings">
        <div className="market-section-head">
          <div><h2 id="recent-title">{t('home.recentTitle')}</h2><p className="muted">{t('home.recentLead')}</p></div>
          <Link to="/browse" className="market-text-link">{t('home.recentViewAll')} <ArrowUpRightIcon size={18} /></Link>
        </div>
        {status === 'loading' && <LoadingGrid count={8} />}
        {status === 'error' && <ErrorState onRetry={() => setAttempt((value) => value + 1)} />}
        {status === 'ready' && (listings.length ? <div className="grid-listings">{listings.map((listing) => <ListingCard listing={listing} key={listing.id} />)}</div> : <EmptyState title={t('home.emptyInventory')}><Link className="btn" to="/sell">{t('market.sell')}</Link></EmptyState>)}
      </section>

      <section className="market-sell" aria-labelledby="sell-title">
        <div><p className="eyebrow">{t('market.sellEyebrow')}</p><h2 id="sell-title">{t('market.sellTitle')}</h2><p>{t('market.sellBody')}</p></div>
        <Link to="/sell" className="btn btn--accent">{t('market.sell')} <ArrowUpRightIcon size={18} /></Link>
      </section>
    </div>
  );
}
