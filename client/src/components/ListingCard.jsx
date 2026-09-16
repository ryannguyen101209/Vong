import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { formatPrice, formatDate } from '../lib/format.js';
import { SaveButton } from './SaveButton.jsx';
import { BoxIcon } from './Icons.jsx';

export function ListingImage({ listing, alt }) {
  if (!listing.image_path) {
    return (
      <div className="media-fallback">
        <BoxIcon />
      </div>
    );
  }
  return <img src={listing.image_path} alt={alt} loading="lazy" />;
}

export function ListingCard({ listing }) {
  const { t, lang, localized } = useI18n();
  const title = localized(listing, 'title');

  return (
    <article className="listing-card">
      <div className="listing-card__media">
        <ListingImage listing={listing} alt={title} />
        <SaveButton listingId={listing.id} />
      </div>

      <div className="listing-card__body">
        <Link to={`/listing/${listing.id}`} style={{ textDecoration: 'none' }}>
          <h3 className="listing-card__title">{title}</h3>
        </Link>
        <span className="listing-card__price">{formatPrice(listing.price_vnd, lang)}</span>
        <div className="listing-card__meta">
          {[
            t(`districts.${listing.district}`),
            t(`conditions.${listing.condition}`),
            formatDate(listing.published_at || listing.created_at, lang),
          ].map((item, index) => (
            <span key={item}>
              {index > 0 && <span aria-hidden="true" className="dot">·</span>}
              {item}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}
