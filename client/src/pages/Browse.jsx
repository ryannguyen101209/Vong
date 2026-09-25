import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { api } from '../lib/api.js';
import { Feed } from '../components/Feed.jsx';
import { MarketRail } from '../components/MarketRail.jsx';
import { ErrorState, LoadingFeed } from '../components/States.jsx';
import { SearchIcon } from '../components/Icons.jsx';

const SORTS = [
  { value: 'newest', key: 'browse.sortNewest' },
  { value: 'price_asc', key: 'browse.sortPriceAsc' },
  { value: 'price_desc', key: 'browse.sortPriceDesc' },
];

export function Browse() {
  const { t } = useI18n();
  // Filters live in the URL so a filtered view can be shared or bookmarked.
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const district = params.get('district') ?? '';
  const sort = params.get('sort') ?? 'newest';

  const [searchInput, setSearchInput] = useState(search);
  const [meta, setMeta] = useState({ categories: [], districts: [], fee_vnd: null });
  const [listings, setListings] = useState([]);
  const [status, setStatus] = useState('loading');
  const requestId = useRef(0);

  useEffect(() => {
    api.meta().then(setMeta).catch(() => {});
  }, []);

  // Keep the box in step when the URL changes from outside (back button, links).
  useEffect(() => setSearchInput(search), [search]);

  // Debounced so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (searchInput) next.set('q', searchInput);
      else next.delete('q');
      if (next.toString() !== params.toString()) setParams(next, { replace: true });
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const load = useCallback(() => {
    const currentRequest = ++requestId.current;
    setStatus('loading');
    api
      .listings({ search, category, district, sort })
      .then((data) => {
        if (currentRequest !== requestId.current) return;
        setListings(data.listings);
        setStatus('ready');
      })
      .catch(() => {
        if (currentRequest === requestId.current) setStatus('error');
      });
  }, [search, category, district, sort]);

  useEffect(() => {
    load();
    return () => { requestId.current += 1; };
  }, [load]);

  const update = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  const hasFilters = Boolean(search || category || district || sort !== 'newest');
  const resultLabel = listings.length === 1 ? t('browse.resultsOne') : t('browse.resultsMany', { count: listings.length });

  return (
    <div className="market">
      <div className="market__top">
        <div className="shell">
          <div className="market__head">
            <h1>{t('browse.title')}</h1>
          </div>

          <label className="market-search market-search--always">
            <SearchIcon />
            <span className="sr-only">{t('browse.searchLabel')}</span>
            <input type="search" value={searchInput} placeholder={t('browse.searchPlaceholder')} onChange={(event) => setSearchInput(event.target.value)} />
          </label>

          <ul className="threads" aria-label={t('market.districts')}>
            <li>
              <button type="button" className="thread-tab" aria-pressed={!district} onClick={() => update('district', '')}>{t('market.allDistricts')}</button>
            </li>
            {meta.districts.map((value) => (
              <li key={value}>
                <button type="button" className="thread-tab" aria-pressed={district === value} onClick={() => update('district', value)}>{t(`districts.${value}`)}</button>
              </li>
            ))}
          </ul>

          <div className="filter-row">
            <label>
              <span className="sr-only">{t('listing.category')}</span>
              <select className="select" value={category} onChange={(event) => update('category', event.target.value)}>
                <option value="">{t('browse.allCategories')}</option>
                {meta.categories.map((value) => <option key={value} value={value}>{t(`categories.${value}`)}</option>)}
              </select>
            </label>
            <label>
              <span className="sr-only">{t('browse.sortLabel')}</span>
              <select className="select" value={sort} onChange={(event) => update('sort', event.target.value)}>
                {SORTS.map((option) => <option key={option.value} value={option.value}>{t(option.key)}</option>)}
              </select>
            </label>
            {hasFilters && <button type="button" className="link-btn" onClick={() => setParams({})}>{t('browse.clearFilters')}</button>}
          </div>
        </div>
      </div>

      <div className="market__thread">
        <div className="shell market__inner">
          <section className="market__feed" aria-label={t('browse.title')} aria-busy={status === 'loading'}>
            {status === 'loading' && <LoadingFeed />}
            {status === 'error' && <ErrorState onRetry={load} />}
            {status === 'ready' && listings.length === 0 && (
              <div className="thread-empty">
                <p className="system-msg">{hasFilters ? t('browse.emptyBody') : t('market.emptyAll')}</p>
                {hasFilters
                  ? <button type="button" className="btn" onClick={() => setParams({})}>{t('browse.clearFilters')}</button>
                  : <Link to="/sell" className="btn btn--primary">{t('market.firstCta')}</Link>}
              </div>
            )}
            {status === 'ready' && listings.length > 0 && (
              <>
                <p className="system-msg feed__count">{resultLabel}</p>
                <Feed listings={listings} byDay={sort === 'newest'} />
              </>
            )}
          </section>

          <MarketRail fee={meta.fee_vnd} />
        </div>
      </div>
    </div>
  );
}
