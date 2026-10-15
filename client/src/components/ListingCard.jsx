import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { formatPrice } from '../lib/format.js';
import { SaveButton } from './SaveButton.jsx';
import { BoxIcon } from './Icons.jsx';

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

export function ListingCard({ listing }) {
  const { t, lang, localized } = useI18n();
  const title = localized(listing, 'title');

  return (
    <article className={`listing-card${listing.status === 'sold' ? ' listing-card--sold' : ''}`}>
      <div className="listing-card__media">
        <Link className="listing-card__image-link" to={`/listing/${listing.id}`} aria-label={title}>
          <ListingImage listing={listing} alt="" />
        </Link>
        {listing.status === 'sold' && <span className="listing-card__sold">{t('status.sold')}</span>}
        <SaveButton listingId={listing.id} likes={listing.likes ?? 0} />
      </div>

      <div className="listing-card__body">
        <span className="listing-card__price">{formatPrice(listing.price_vnd, lang)}</span>
        <Link to={`/listing/${listing.id}`} style={{ textDecoration: 'none' }}>
          <h3 className="listing-card__title">{title}</h3>
        </Link>
        <p className="listing-card__meta">
          {t(`cities.${listing.city || 'ho_chi_minh'}`)} · {t(`conditions.${listing.condition}`)}
        </p>
      </div>
    </article>
  );
}
