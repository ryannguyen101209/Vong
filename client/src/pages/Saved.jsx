import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { useSaved } from '../lib/saved.jsx';
import { api } from '../lib/api.js';
import { formatPrice, formatDate } from '../lib/format.js';
import { ListingImage } from '../components/ListingCard.jsx';
import { SaveReasonDialog, reasonLabel } from '../components/SaveReasonDialog.jsx';
import { EmptyState } from '../components/States.jsx';

export function Saved() {
  const { t, lang, localized } = useI18n();
  const { items, save, remove } = useSaved();
  const [listings, setListings] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  // The ids live in the browser; the listing data still comes from the API.
  useEffect(() => {
    if (items.length === 0) {
      setListings({});
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .listings({ ids: items.map((item) => item.id) })
      .then((data) => {
        setListings(Object.fromEntries(data.listings.map((listing) => [listing.id, listing])));
      })
      .catch(() => setListings({}))
      .finally(() => setLoading(false));
    // Only refetch when the set of saved ids changes, not when a reason is edited.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((item) => item.id).join(',')]);

  if (items.length === 0) {
    return (
      <div className="shell section editorial-page saved-page">
        <div className="section-head">
          <h1>{t('saved.title')}</h1>
          <p className="lead">{t('saved.lead')}</p>
        </div>
        <EmptyState title={t('saved.emptyTitle')} body={t('saved.emptyBody')}>
          <Link to="/browse" className="btn btn--accent">{t('saved.emptyCta')}</Link>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="shell section editorial-page saved-page">
      <div className="section-head">
        <h1>{t('saved.title')}</h1>
        <p className="lead">{t('saved.lead')}</p>
      </div>

      {loading ? (
        <p className="muted">{t('common.loading')}</p>
      ) : (
        <div className="stack" style={{ gap: 16 }}>
          {items.map((entry) => {
            const listing = listings[entry.id];
            const title = listing ? localized(listing, 'title') : null;

            return (
              <article className="card saved-item" key={entry.id}>
                <div className="saved-item__media">
                  {listing ? <ListingImage listing={listing} alt={title} /> : <div className="media-fallback" />}
                </div>

                <div className="stack" style={{ gap: 8 }}>
                  {listing ? (
                    <>
                      <Link to={`/listing/${listing.id}`} style={{ textDecoration: 'none' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{title}</h3>
                      </Link>
                      <strong style={{ color: 'var(--accent)' }}>
                        {formatPrice(listing.price_vnd, lang)}
                      </strong>
                    </>
                  ) : (
                    <p className="muted" style={{ margin: 0 }}>{t('saved.unavailable')}</p>
                  )}

                  <div className="row" style={{ gap: 10 }}>
                    <span className="reason-tag">{reasonLabel(entry, t)}</span>
                    <span className="small muted">
                      {t('saved.savedOn', { date: formatDate(entry.savedAt, lang) })}
                    </span>
                  </div>
                </div>

                <div className="saved-item__actions">
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => setEditing(entry)}>
                    {t('saved.editReason')}
                  </button>
                  <button type="button" className="btn btn--danger btn--small" onClick={() => remove(entry.id)}>
                    {t('common.remove')}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="small muted" style={{ marginTop: 28 }}>{t('saved.storageNote')}</p>

      {editing && (
        <SaveReasonDialog
          existing={editing}
          onClose={() => setEditing(null)}
          onSubmit={(reason) => {
            save(editing.id, reason);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
