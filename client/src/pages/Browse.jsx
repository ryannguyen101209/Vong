import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { api } from '../lib/api.js';
import { ListingCard } from '../components/ListingCard.jsx';
import { EmptyState, ErrorState, LoadingGrid } from '../components/States.jsx';
import { SearchIcon } from '../components/Icons.jsx';
import { AreaOptions } from '../components/AreaOptions.jsx';

const SORTS = [
  { value: 'newest', key: 'browse.sortNewest' },
  { value: 'price_asc', key: 'browse.sortPriceAsc' },
  { value: 'price_desc', key: 'browse.sortPriceDesc' },
];

// Price bands in dong. Kept in the URL by key, so ?price=under_200k can be shared.
// max is inclusive, so each band stops one dong short of the next one's min.
const PRICE_BANDS = [
  { value: 'under_200k', max: 199_999 },
  { value: '200k_500k', min: 200_000, max: 499_999 },
  { value: '500k_1m', min: 500_000, max: 999_999 },
  { value: '1m_3m', min: 1_000_000, max: 2_999_999 },
  { value: 'over_3m', min: 3_000_000 },
];

export function Browse() {
  const { t } = useI18n();
  // Filters live in the URL so a filtered view can be shared or bookmarked.
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const sort = params.get('sort') ?? 'newest';
  const city = params.get('city') ?? '';
  const district = params.get('district') ?? '';
  const price = params.get('price') ?? '';
  // 'all' (default: available first, then sold), 'available' or 'sold'.
  const show = params.get('show') ?? 'all';
  const band = PRICE_BANDS.find((item) => item.value === price);

  const [searchInput, setSearchInput] = useState(search);
  const [categories, setCategories] = useState([]);
  const [cities, setCities] = useState([]);
  const [listings, setListings] = useState([]);
  const [status, setStatus] = useState('loading');
  const requestId = useRef(0);

  useEffect(() => {
    api.meta()
      .then((meta) => {
        setCategories(meta.categories);
        setCities(meta.cities ?? []);
      })
      .catch(() => setCategories([]));
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
      .listings({ search, category, city, district, minPrice: band?.min, maxPrice: band?.max, sort, show })
      .then((data) => {
        if (currentRequest !== requestId.current) return;
        setListings(data.listings);
        setStatus('ready');
      })
      .catch(() => {
        if (currentRequest === requestId.current) setStatus('error');
      });
  }, [search, category, city, district, band, sort, show]);

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

  const hasFilters = Boolean(search || category || city || district || band || sort !== 'newest' || show !== 'all');

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
            <span className="sr-only">{t('browse.cityLabel')}</span>
            <select
              className="select"
              value={city}
              onChange={(event) => {
                // A district only makes sense inside its own city, so changing city clears it.
                const next = new URLSearchParams(params);
                if (event.target.value) next.set('city', event.target.value); else next.delete('city');
                next.delete('district');
                setParams(next, { replace: true });
              }}
            >
              <option value="">{t('browse.allCities')}</option>
              {cities.map((item) => (
                <option key={item.key} value={item.key}>{t(`cities.${item.key}`)}</option>
              ))}
            </select>
          </label>

          {city && (
            <label>
              <span className="sr-only">{t('browse.districtLabel')}</span>
              <select className="select" value={district} onChange={(event) => update('district', event.target.value)}>
                <option value="">{t('browse.allDistricts')}</option>
                <AreaOptions keys={cities.find((item) => item.key === city)?.districts ?? []} current={district} />
              </select>
            </label>
          )}

          <label>
            <span className="sr-only">{t('browse.priceLabel')}</span>
            <select className="select" value={band ? price : ''} onChange={(event) => update('price', event.target.value)}>
              <option value="">{t('browse.anyPrice')}</option>
              {PRICE_BANDS.map((option) => (
                <option key={option.value} value={option.value}>{t(`browse.price_${option.value}`)}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="sr-only">{t('browse.showLabel')}</span>
            <select className="select" value={show} onChange={(event) => update('show', event.target.value === 'all' ? '' : event.target.value)}>
              <option value="all">{t('browse.showAll')}</option>
              <option value="available">{t('browse.showAvailable')}</option>
              <option value="sold">{t('browse.showSold')}</option>
            </select>
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
          <EmptyState title={t(hasFilters ? 'browse.emptyTitle' : 'market.firstTitle')} body={t(hasFilters ? 'browse.emptyBody' : 'market.firstBody')}>
            {!hasFilters && <Link to="/sell" className="btn btn--accent">{t('market.firstCta')}</Link>}
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
