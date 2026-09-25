import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { formatPrice, formatRelative } from '../lib/format.js';
import { SaveButton } from './SaveButton.jsx';
import { Avatar } from './Avatar.jsx';
import { BoxIcon, ReplyIcon } from './Icons.jsx';

export function ListingImage({ listing, alt }) {
  const [failedPath, setFailedPath] = useState(null);
  if (!listing.image_path || failedPath === listing.image_path) {
    return (
      <div className="media-fallback">
        <BoxIcon />
      </div>
    );
  }
  return <img src={listing.image_path} alt={alt} loading="lazy" onError={() => setFailedPath(listing.image_path)} />;
}

/** A listing as a post in the thread: who, where, when, then the item. */
export function ListingPost({ listing }) {
  const { t, lang, localized } = useI18n();
  const title = localized(listing, 'title');
  const posted = listing.published_at || listing.created_at;

  return (
    <li className="post">
      <Avatar name={listing.seller_name} />
      <div className="post__body">
        <p className="post__meta">
          <strong>{listing.seller_name}</strong>
          <span>{t(`districts.${listing.district}`)}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={posted}>{formatRelative(posted, lang)}</time>
        </p>
        <Link className="bubble post__bubble" to={`/listing/${listing.id}`}>
          <div className="post__photo">
            <ListingImage listing={listing} alt="" />
          </div>
          <div className="post__text">
            <h3 className="post__title">{title}</h3>
            <p className="post__price">
              <strong>{formatPrice(listing.price_vnd, lang)}</strong>
              <span>{t(`conditions.${listing.condition}`)}</span>
            </p>
          </div>
        </Link>
        <div className="post__actions">
          <Link className="reply-link" to={`/messages?listing=${listing.id}`}>
            <ReplyIcon /> {t('listing.messageSeller')}
          </Link>
          <SaveButton listingId={listing.id} />
        </div>
      </div>
    </li>
  );
}
