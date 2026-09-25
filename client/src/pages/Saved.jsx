import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { useSaved } from '../lib/saved.jsx';
import { api } from '../lib/api.js';
import { formatPrice, formatDate, formatRelative } from '../lib/format.js';
import { ListingImage } from '../components/ListingCard.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { SaveReasonDialog, reasonLabel } from '../components/SaveReasonDialog.jsx';
import { EmptyState } from '../components/States.jsx';
import { BoxIcon } from '../components/Icons.jsx';

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

  const head = (
    <div className="personal__top">
      <div className="shell personal__shell personal__head">
        <div className="personal__intro">
          <h1>{t('saved.title')}</h1>
          <p>{t('saved.lead')}</p>
        </div>
      </div>
    </div>
  );

  if (items.length === 0) {
    return (
      <div className="personal">
        {head}
        <div className="personal__thread">
          <div className="shell personal__shell">
            <EmptyState title={t('saved.emptyTitle')} body={t('saved.emptyHint')}>
              <Link to="/browse" className="btn btn--primary">{t('saved.emptyCta')}</Link>
            </EmptyState>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="personal">
      {head}
      <div className="personal__thread">
        <div className="shell personal__shell">
          <p className="system-msg saved__note">{t('saved.browserOnly')}</p>

          {loading ? (
            <p className="system-msg" role="status">{t('common.loading')}</p>
          ) : (
            <ol className="saved-list">
              {items.map((entry) => {
                const listing = listings[entry.id];
                const title = listing ? localized(listing, 'title') : null;
                const reason = reasonLabel(entry, t);
                const titleId = `saved-title-${entry.id}`;
                const posted = listing ? listing.published_at || listing.created_at : null;

                return (
                  <li className="saved-post" key={entry.id}>
                    {listing
                      ? <Avatar name={listing.seller_name} />
                      : <span className="avatar saved-post__ghost" aria-hidden="true" />}

                    <div className="saved-post__body">
                      {listing && (
                        <p className="post__meta">
                          <strong>{listing.seller_name}</strong>
                          <span>{t(`districts.${listing.district}`)}</span>
                          <span aria-hidden="true">·</span>
                          <time dateTime={posted}>{formatRelative(posted, lang)}</time>
                        </p>
                      )}

                      {listing ? (
                        <Link className="bubble mini-post" to={`/listing/${listing.id}`}>
                          <span className="mini-post__photo"><ListingImage listing={listing} alt="" /></span>
                          <div className="mini-post__text">
                            <h2 className="mini-post__title" id={titleId}>{title}</h2>
                            <p className="mini-post__price">
                              <strong>{formatPrice(listing.price_vnd, lang)}</strong>
                              <span>{t(`conditions.${listing.condition}`)}</span>
                            </p>
                          </div>
                        </Link>
                      ) : (
                        <div className="bubble mini-post mini-post--gone">
                          <span className="mini-post__photo"><span className="media-fallback"><BoxIcon /></span></span>
                          <div className="mini-post__text">
                            <p className="mini-post__gone" id={titleId}>{t('saved.unavailable')}</p>
                          </div>
                        </div>
                      )}

                      <div className="saved-post__reply">
                        {reason && (
                          <p className="saved-post__reason">
                            <span className="sr-only">{t('saved.reasonLabel')}: </span>
                            {reason}
                          </p>
                        )}
                        <div className="saved-post__meta">
                          <span>{t('saved.savedOn', { date: formatDate(entry.savedAt, lang) })}</span>
                          <span className="saved-post__actions">
                            <button type="button" className="saved-post__action" aria-describedby={titleId} onClick={() => setEditing(entry)}>
                              {t('saved.editReason')}
                            </button>
                            <button type="button" className="saved-post__action saved-post__action--remove" aria-describedby={titleId} onClick={() => remove(entry.id)}>
                              {t('common.remove')}
                            </button>
                          </span>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>

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
