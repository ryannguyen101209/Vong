import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api.js';
import { formatPrice, formatDate } from '../lib/format.js';
import { EmptyState, ErrorState } from '../components/States.jsx';
import { ListingImage } from '../components/ListingCard.jsx';
import { ShareButton } from '../components/ShareButton.jsx';

const BADGE = {
  pending_payment: 'badge--warning',
  awaiting_approval: 'badge--warning',
  published: 'badge--positive',
  sold: '',
  rejected: 'badge--danger',
};

export function MyListings() {
  const { t } = useI18n();
  const { profile, loading, openSignIn } = useAuth();
  if (loading) return <div className="shell section"><p role="status">{t('common.loading')}</p></div>;
  if (!profile) {
    return (
      <div className="shell section messages-gate">
        <h1>{t('myListings.signInTitle')}</h1>
        <p className="lead">{t('myListings.signInBody')}</p>
        <button className="btn btn--accent" onClick={openSignIn}>{t('auth.signIn')}</button>
      </div>
    );
  }
  return <Manager key={profile.id} />;
}

function Manager() {
  const { t, lang, localized } = useI18n();
  const [listings, setListings] = useState([]);
  const [status, setStatus] = useState('loading');
  const [busy, setBusy] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [actionError, setActionError] = useState(false);

  const load = useCallback(() => {
    setStatus('loading');
    api.myListings()
      .then((data) => { setListings(data.listings); setStatus('ready'); })
      .catch(() => setStatus('error'));
  }, []);
  useEffect(load, [load]);

  const run = async (id, action) => {
    setBusy(id);
    setActionError(false);
    try {
      await action(id);
      setConfirming(null);
      const data = await api.myListings();
      setListings(data.listings);
    } catch {
      setActionError(true);
    } finally {
      setBusy(null);
    }
  };

  if (status === 'loading') return <div className="shell section"><p role="status">{t('common.loading')}</p></div>;
  if (status === 'error') return <div className="shell section"><ErrorState onRetry={load} /></div>;

  return (
    <div className="shell section editorial-page">
      <div className="section-head">
        <h1>{t('myListings.title')}</h1>
        <p className="lead">{t('myListings.lead')}</p>
      </div>

      {actionError && <div className="notice notice--danger" role="alert" style={{ marginBottom: 20 }}>{t('common.error')}</div>}

      {listings.length === 0 ? (
        <EmptyState title={t('myListings.emptyTitle')} body={t('myListings.emptyBody')}>
          <Link to="/sell" className="btn btn--accent">{t('nav.sell')}</Link>
        </EmptyState>
      ) : (
        <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0, gap: 16 }}>
          {listings.map((listing) => {
            const title = localized(listing, 'title');
            const isBusy = busy === listing.id;
            return (
              <li key={listing.id} className="card panel" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ width: 96, height: 96, borderRadius: 12, overflow: 'hidden', flex: '0 0 96px' }}>
                  <ListingImage listing={listing} alt={title} />
                </div>
                <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <strong>{title}</strong>
                    <span className={`badge ${BADGE[listing.status] ?? ''}`}>{t(`status.${listing.status}`)}</span>
                  </div>
                  <p className="small muted" style={{ margin: '4px 0 0' }}>
                    {formatPrice(listing.price_vnd, lang)} · {t(`districts.${listing.district}`)} · {formatDate(listing.created_at, lang)}
                    {listing.status === 'published' && ` · ${t('myListings.views', { count: listing.views })}`}
                  </p>
                  <p className="small" style={{ margin: '8px 0 0' }}>{t(`myListings.hint.${listing.status}`, { reason: listing.reject_reason || '—' })}</p>

                  <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                    {(listing.status === 'pending_payment' || listing.status === 'rejected') && (
                      <Link to={`/payment/${listing.id}`} className="btn btn--accent btn--small">
                        {listing.status === 'rejected' ? t('myListings.resubmit') : t('myListings.pay')}
                      </Link>
                    )}
                    {(listing.status === 'published' || listing.status === 'sold') && (
                      <Link to={`/listing/${listing.id}`} className="btn btn--ghost btn--small">{t('myListings.view')}</Link>
                    )}
                    {listing.status === 'published' && (
                      <ShareButton
                        small
                        url={`${window.location.origin}/listing/${listing.id}`}
                        title={localized(listing, 'title')}
                        text={t('listing.shareText', { title: localized(listing, 'title'), price: formatPrice(listing.price_vnd, lang) })}
                      />
                    )}
                    {listing.status === 'published' && (
                      <button type="button" className="btn btn--accent btn--small" disabled={isBusy} onClick={() => run(listing.id, api.markSold)}>
                        {t('myListings.markSold')}
                      </button>
                    )}
                    {listing.status === 'sold' && (
                      <button type="button" className="btn btn--ghost btn--small" disabled={isBusy} onClick={() => run(listing.id, api.relist)}>
                        {t('myListings.relist')}
                      </button>
                    )}
                    <Link to={`/listing/${listing.id}/edit`} className="btn btn--ghost btn--small">{t('myListings.edit')}</Link>
                    {confirming === listing.id ? (
                      <>
                        <button type="button" className="btn btn--small" style={{ color: 'var(--danger)' }} disabled={isBusy} onClick={() => run(listing.id, api.deleteListing)}>
                          {t('myListings.confirmDelete')}
                        </button>
                        <button type="button" className="btn btn--ghost btn--small" onClick={() => setConfirming(null)}>{t('myListings.cancel')}</button>
                      </>
                    ) : (
                      <button type="button" className="btn btn--ghost btn--small" onClick={() => setConfirming(listing.id)}>
                        {t('myListings.delete')}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
