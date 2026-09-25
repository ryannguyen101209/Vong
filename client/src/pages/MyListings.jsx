import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api.js';
import { formatDate, formatPrice } from '../lib/format.js';
import { ListingImage } from '../components/ListingCard.jsx';
import { PublishKeyForm } from '../components/PublishKeyForm.jsx';
import { EmptyState, ErrorState } from '../components/States.jsx';

const BADGE = {
  pending_payment: 'badge--warning',
  awaiting_approval: '',
  approved: 'badge--positive',
  published: 'badge--positive',
  rejected: 'badge--danger',
};

function NextStep({ listing, onChange }) {
  const { t, lang } = useI18n();
  switch (listing.status) {
    case 'pending_payment':
      return (
        <div className="my-listing__next">
          <p>{t('mine.nextPay', { fee: formatPrice(listing.fee_vnd, lang) })}</p>
          <Link className="btn btn--primary btn--small" to={`/payment/${listing.id}`}>{t('mine.payCta')}</Link>
        </div>
      );
    case 'awaiting_approval':
      return <div className="my-listing__next"><p>{t('mine.nextChecking', { email: listing.seller_email })}</p></div>;
    case 'approved':
      return <PublishKeyForm listing={listing} keyInfo={listing.key} onPublished={onChange} compact />;
    case 'published':
      return (
        <div className="my-listing__next">
          <p>{t('mine.nextLive')}</p>
          <div className="row">
            <Link className="btn btn--small" to={`/listing/${listing.id}`}>{t('payment.viewListing')}</Link>
            <Link className="btn btn--small" to="/messages">{t('nav.messages')}</Link>
          </div>
        </div>
      );
    case 'rejected':
      return (
        <div className="my-listing__next">
          <p>{t('payment.statusRejectedBody', { reason: listing.reject_reason || '—' })}</p>
          <Link className="btn btn--small" to={`/payment/${listing.id}`}>{t('mine.rejectedCta')}</Link>
        </div>
      );
    default:
      return null;
  }
}

export function MyListings() {
  const { t, lang, localized } = useI18n();
  const { profile, loading: authLoading, openSignIn } = useAuth();
  const [listings, setListings] = useState([]);
  const [status, setStatus] = useState('loading');

  const load = useCallback(() => {
    if (!profile) return;
    api.myListings()
      .then((data) => { setListings(data.listings); setStatus('ready'); })
      .catch(() => setStatus('error'));
  }, [profile]);

  useEffect(load, [load]);

  if (authLoading) return <div className="shell section"><p role="status">{t('common.loading')}</p></div>;
  if (!profile) {
    return (
      <div className="shell section messages-gate">
        <h1>{t('mine.signInTitle')}</h1>
        <p className="lead">{t('mine.signInBody')}</p>
        <button type="button" className="btn btn--primary" onClick={openSignIn}>{t('auth.signIn')}</button>
      </div>
    );
  }

  return (
    <div className="shell section editorial-page mine-page">
      <div className="spread section-head mine-head">
        <div>
          <h1>{t('mine.title')}</h1>
          <p className="lead">{t('mine.lead')}</p>
        </div>
        <Link className="btn btn--primary" to="/sell">{t('market.sell')}</Link>
      </div>

      {status === 'loading' && <p role="status" className="muted">{t('common.loading')}</p>}
      {status === 'error' && <ErrorState onRetry={load} />}
      {status === 'ready' && listings.length === 0 && (
        <EmptyState title={t('mine.emptyTitle')} body={t('mine.emptyBody')}>
          <Link className="btn btn--primary" to="/sell">{t('market.firstCta')}</Link>
        </EmptyState>
      )}
      {status === 'ready' && listings.length > 0 && (
        <ol className="my-listings">
          {listings.map((listing) => (
            <li className={`my-listing${listing.status === 'approved' ? ' my-listing--action' : ''}`} key={listing.id}>
              <Link to={listing.status === 'published' ? `/listing/${listing.id}` : `/payment/${listing.id}`} className="my-listing__media" tabIndex={-1} aria-hidden="true">
                <ListingImage listing={listing} alt="" />
              </Link>
              <div className="my-listing__body">
                <div className="my-listing__top">
                  <h2 className="my-listing__title">{localized(listing, 'title')}</h2>
                  <span className={`badge ${BADGE[listing.status] ?? ''}`}>{t(`status.${listing.status}`)}</span>
                </div>
                <p className="my-listing__meta">
                  <span>{formatPrice(listing.price_vnd, lang)}</span>
                  <span>{listing.ref}</span>
                  <span>{formatDate(listing.created_at, lang)}</span>
                </p>
              </div>
              <div className="my-listing__step">
                <NextStep listing={listing} onChange={load} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
