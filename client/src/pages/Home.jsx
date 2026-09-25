import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { api } from '../lib/api.js';
import { formatPrice } from '../lib/format.js';
import { Feed, FeedComposer } from '../components/Feed.jsx';
import { MarketRail } from '../components/MarketRail.jsx';
import { ErrorState, LoadingFeed } from '../components/States.jsx';
import { SearchIcon } from '../components/Icons.jsx';

const FEED_SIZE = 20;

export function Home() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [meta, setMeta] = useState({ categories: [], districts: [], fee_vnd: null });
  const [district, setDistrict] = useState('');
  const [listings, setListings] = useState([]);
  const [status, setStatus] = useState('loading');
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.meta().then(setMeta).catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    api.listings({ sort: 'newest', district })
      .then((data) => {
        if (!active) return;
        setListings(data.listings);
        setStatus('ready');
      })
      .catch(() => active && setStatus('error'));
    return () => { active = false; };
  }, [district, attempt]);

  const onSearch = (event) => {
    event.preventDefault();
    const query = search.trim();
    navigate(query ? `/browse?q=${encodeURIComponent(query)}` : '/browse');
  };

  const fee = meta.fee_vnd == null ? '…' : formatPrice(meta.fee_vnd, lang);

  return (
    <div className="market">
      <div className="market__top">
        <div className="shell">
          <div className="market__head">
            <h1>{t('market.title')}</h1>
            <p>{t('market.lead', { fee })}</p>
          </div>

          <form className="market-search" role="search" onSubmit={onSearch}>
            <SearchIcon />
            <label className="sr-only" htmlFor="home-search">{t('browse.searchLabel')}</label>
            <input id="home-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('browse.searchPlaceholder')} />
          </form>

          <ul className="threads" aria-label={t('market.districts')}>
            <li>
              <button type="button" className="thread-tab" aria-pressed={!district} onClick={() => setDistrict('')}>{t('market.allDistricts')}</button>
            </li>
            {meta.districts.map((value) => (
              <li key={value}>
                <button type="button" className="thread-tab" aria-pressed={district === value} onClick={() => setDistrict(value)}>{t(`districts.${value}`)}</button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="market__thread">
        <div className="shell market__inner">
          <section className="market__feed" aria-label={t('home.recentTitle')}>
            <FeedComposer />
            {status === 'loading' && <LoadingFeed />}
            {status === 'error' && <ErrorState onRetry={() => setAttempt((value) => value + 1)} />}
            {status === 'ready' && listings.length === 0 && (
              <div className="thread-empty">
                <p className="system-msg">{district ? t('market.emptyDistrict', { district: t(`districts.${district}`) }) : t('market.emptyAll')}</p>
              </div>
            )}
            {status === 'ready' && listings.length > 0 && (
              <>
                <Feed listings={listings.slice(0, FEED_SIZE)} />
                {listings.length > FEED_SIZE && (
                  <Link className="btn feed__more" to={district ? `/browse?district=${district}` : '/browse'}>{t('market.seeAll')}</Link>
                )}
              </>
            )}
          </section>

          <MarketRail categories={meta.categories} fee={meta.fee_vnd} />
        </div>
      </div>
    </div>
  );
}
