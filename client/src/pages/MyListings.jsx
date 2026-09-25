import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api.js';
import { formatPrice, formatRelative } from '../lib/format.js';
import { ListingImage } from '../components/ListingCard.jsx';
import { PublishKeyForm } from '../components/PublishKeyForm.jsx';
import { EmptyState, ErrorState } from '../components/States.jsx';

/** Dot colour and word for each stage. Waiting on Vòng stays neutral; waiting on you is amber. */
const STATUS = {
  pending_payment: { tone: 'wait', label: 'status.pending_payment' },
  awaiting_approval: { tone: null, label: 'status.awaiting_approval' },
  approved: { tone: 'info', label: 'mine.statusApproved' },
  published: { tone: 'ok', label: 'status.published' },
  rejected: { tone: 'bad', label: 'status.rejected' },
};

/** The one thing this listing needs next, written under the post like a reply. */
function NextStep({ listing, onChange }) {
  const { t, lang } = useI18n();
  switch (listing.status) {
    case 'pending_payment':
      return (
        <div className="mine-step">
          <p>{t('mine.nextPay', { fee: formatPrice(listing.fee_vnd, lang) })}</p>
          <Link className="btn btn--primary" to={`/payment/${listing.id}`}>{t('mine.payCta')}</Link>
        </div>
      );
    case 'awaiting_approval':
      return <div className="mine-step"><p>{t('mine.nextChecking', { email: listing.seller_email })}</p></div>;
    case 'approved':
      return <PublishKeyForm listing={listing} keyInfo={listing.key} onPublished={onChange} compact />;
    case 'published':
      return (
        <div className="mine-step">
          <p>{t('mine.nextLive')}</p>
          <div className="mine-step__actions">
            <Link className="btn" to={`/listing/${listing.id}`}>{t('payment.viewListing')}</Link>
            <Link className="btn" to="/messages">{t('nav.messages')}</Link>
          </div>
        </div>
      );
    case 'rejected':
      return (
        <div className="mine-step">
          <p>
            {listing.reject_reason
              ? t('payment.statusRejectedBody', { reason: listing.reject_reason })
              : t('payment.statusRejectedTitle')}
          </p>
          <Link className="btn" to={`/payment/${listing.id}`}>{t('mine.rejectedCta')}</Link>
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

  if (authLoading) return <div className="shell page"><p className="system-msg" role="status">{t('common.loading')}</p></div>;
  if (!profile) {
    return (
      <div className="shell gate">
        <h1>{t('mine.signInTitle')}</h1>
        <p>{t('mine.signInBody')}</p>
        <button type="button" className="btn btn--primary" onClick={openSignIn}>{t('auth.signIn')}</button>
      </div>
    );
  }

  return (
    <div className="personal">
      <div className="personal__top">
        <div className="shell personal__shell personal__head">
          <div className="personal__intro">
            <h1>{t('mine.title')}</h1>
            <p>{t('mine.lead')}</p>
          </div>
        </div>
      </div>

      <div className="personal__thread">
        <div className="shell personal__shell">
          {status === 'loading' && <p className="system-msg" role="status">{t('common.loading')}</p>}
          {status === 'error' && <ErrorState onRetry={load} />}
          {status === 'ready' && listings.length === 0 && (
            <EmptyState title={t('mine.emptyTitle')} body={t('mine.emptyBody')}>
              <Link className="btn btn--primary" to="/sell">{t('market.sell')}</Link>
            </EmptyState>
          )}
          {status === 'ready' && listings.length > 0 && (
            <ol className="mine-list">
              {listings.map((listing) => {
                const stage = STATUS[listing.status] ?? { tone: null, label: `status.${listing.status}` };
                const title = localized(listing, 'title');
                return (
                  <li className={`mine-post mine-post--${listing.status}`} key={listing.id}>
                    <p className="mine-post__meta">
                      <span className={`status${stage.tone ? ` status--${stage.tone}` : ''}`}>{t(stage.label)}</span>
                      <span aria-hidden="true">·</span>
                      <time dateTime={listing.created_at}>{formatRelative(listing.created_at, lang)}</time>
                      <span aria-hidden="true">·</span>
                      <span className="num">{listing.ref}</span>
                    </p>
                    <Link
                      className="bubble mini-post"
                      to={listing.status === 'published' ? `/listing/${listing.id}` : `/payment/${listing.id}`}
                    >
                      <span className="mini-post__photo"><ListingImage listing={listing} alt="" /></span>
                      <div className="mini-post__text">
                        <h2 className="mini-post__title">{title}</h2>
                        <p className="mini-post__price">
                          <strong>{formatPrice(listing.price_vnd, lang)}</strong>
                          <span>{t(`conditions.${listing.condition}`)}</span>
                        </p>
                      </div>
                    </Link>
                    <NextStep listing={listing} onChange={load} />
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
