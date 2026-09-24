import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { api } from '../lib/api.js';
import { ListingCard } from '../components/ListingCard.jsx';
import { EmptyState, ErrorState, LoadingGrid } from '../components/States.jsx';
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
  const sort = params.get('sort') ?? 'newest';

  const [searchInput, setSearchInput] = useState(search);
  const [categories, setCategories] = useState([]);
  const [listings, setListings] = useState([]);
  const [status, setStatus] = useState('loading');
  const requestId = useRef(0);

  useEffect(() => {
    api.meta().then((meta) => setCategories(meta.categories)).catch(() => setCategories([]));
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
      .listings({ search, category, sort })
      .then((data) => {
        if (currentRequest !== requestId.current) return;
        setListings(data.listings);
        setStatus('ready');
      })
      .catch(() => {
        if (currentRequest === requestId.current) setStatus('error');
      });
  }, [search, category, sort]);

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

  const hasFilters = Boolean(search || category || sort !== 'newest');

  const resultLabel = useMemo(
    () => (listings.length === 1 ? t('browse.resultsOne') : t('browse.resultsMany', { count: listings.length })),
    [listings.length, t]
  );

  return (
    <div className="shell section editorial-page browse-page">
      <div className="section-head">
        <h1>{t('browse.title')}</h1>
        <p className="lead">{t('browse.lead')}</p>
      </div>

      <div className="filters">
        <div className="filters__row">
          <label className="search-field">
            <span className="sr-only">{t('browse.searchLabel')}</span>
            <SearchIcon />
            <input
              type="search"
              value={searchInput}
              placeholder={t('browse.searchPlaceholder')}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </label>

          <label>
            <span className="sr-only">{t('browse.sortLabel')}</span>
            <select className="select" value={sort} onChange={(event) => update('sort', event.target.value)}>
              {SORTS.map((option) => (
                <option key={option.value} value={option.value}>{t(option.key)}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="chip-row">
          <button
            type="button"
            className="chip"
            aria-pressed={!category}
            onClick={() => update('category', '')}
          >
            {t('browse.allCategories')}
          </button>
          {categories.map((value) => (
            <button
              key={value}
              type="button"
              className="chip"
              aria-pressed={category === value}
              onClick={() => update('category', category === value ? '' : value)}
            >
              {t(`categories.${value}`)}
            </button>
          ))}
        </div>

        {status === 'ready' && (
          <div className="spread">
            <span className="small muted">{resultLabel}</span>
            {hasFilters && (
              <button type="button" className="link-quiet" onClick={() => setParams({})}>
                {t('browse.clearFilters')}
              </button>
            )}
          </div>
        )}
      </div>

      {status === 'loading' && <LoadingGrid />}
      {status === 'error' && <ErrorState onRetry={load} />}
      {status === 'ready' &&
        (listings.length === 0 ? (
          <EmptyState title={t('browse.emptyTitle')} body={t('browse.emptyBody')}>
            {hasFilters && (
              <button type="button" className="btn btn--ghost" onClick={() => setParams({})}>
                {t('browse.clearFilters')}
              </button>
            )}
          </EmptyState>
        ) : (
          <div className="grid-listings">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        ))}
    </div>
  );
}
