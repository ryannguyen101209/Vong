import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { ListingCard } from '../components/ListingCard.jsx';
import { EmptyState, ErrorState } from '../components/States.jsx';
import { AdminBadge, ReviewForm, ReviewItem, Stars, TrustedBadge } from '../components/Reviews.jsx';
import { PageLoader } from '../components/Loader.jsx';

/** A seller's public page: who they are, what they sell, and what buyers said. */
export function SellerProfile() {
  const { id } = useParams();
  const { t, lang, localized } = useI18n();
  const { profile } = useAuth();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [reviewListing, setReviewListing] = useState('');
  const [thanks, setThanks] = useState(false);

  const load = useCallback(() => {
    api.seller(id)
      .then((result) => {
        setData(result);
        setReviewListing(result.can_review[0]?.id ?? '');
        setStatus('ready');
      })
      .catch((error) => setStatus(error.status === 404 ? 'missing' : 'error'));
  }, [id]);

  // Reload when the visitor signs in, so "can review" reflects them.
  useEffect(load, [load, profile?.id]);

  if (status === 'loading') return <PageLoader />;
  if (status === 'missing') {
    return (
      <div className="shell section">
        <EmptyState title={t('seller.missingTitle')} body={t('seller.missingBody')}>
          <Link to="/browse" className="btn">{t('nav.browse')}</Link>
        </EmptyState>
      </div>
    );
  }
  if (status === 'error') return <div className="shell section"><ErrorState onRetry={load} /></div>;

  const { seller, listings, reviews, can_review: canReview } = data;
  const live = listings.filter((l) => l.status === 'published');
  const sold = listings.filter((l) => l.status === 'sold');
  const since = new Date(seller.member_since).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-GB', { month: 'long', year: 'numeric' });

  return (
    <div className="shell section seller-page">
      <header className="seller-head">
        <span className="avatar avatar--large" aria-hidden="true">
          {((seller.name || '?').trim().split(/\s+/).pop() || '?')[0].toUpperCase()}
        </span>
        <div>
          <div className="seller-head__name">
            <h1>{seller.name}</h1>
            {seller.admin && <AdminBadge />}
            {seller.trusted && <TrustedBadge />}
          </div>
          {seller.admin && <p className="small" style={{ margin: '6px 0 0', color: 'var(--ink-soft)' }}>{t('seller.adminLabel')}</p>}
          <p className="muted" style={{ margin: '6px 0 0' }}>
            {t('seller.memberSince', { date: since })} · {t('seller.liveCount', { n: live.length })}
            {sold.length > 0 && ` · ${t('seller.soldCount', { n: sold.length })}`}
          </p>
          <p className="seller-head__rating">
            {seller.rating_count > 0 ? (
              <>
                <Stars value={seller.rating_avg} />
                <strong>{seller.rating_avg}</strong>
                <span className="muted">{t('seller.reviewCount', { n: seller.rating_count })}</span>
              </>
            ) : (
              <span className="muted">{t('seller.noRating')}</span>
            )}
          </p>
        </div>
      </header>

      <section aria-labelledby="seller-listings" className="seller-section">
        <h2 id="seller-listings">{t('seller.listingsTitle')}</h2>
        {live.length ? (
          <div className="grid-listings">{live.map((listing) => <ListingCard listing={listing} key={listing.id} />)}</div>
        ) : (
          <p className="muted">{t('seller.noLive')}</p>
        )}
        {sold.length > 0 && (
          <>
            <h3 className="seller-subhead">{t('seller.soldTitle')}</h3>
            <div className="grid-listings grid-listings--muted">{sold.map((listing) => <ListingCard listing={listing} key={listing.id} />)}</div>
          </>
        )}
      </section>

      <section aria-labelledby="seller-reviews" className="seller-section">
        <h2 id="seller-reviews">{t('seller.reviewsTitle')}</h2>

        {canReview.length > 0 && !thanks && (
          <div className="card panel review-box">
            <p className="notice__title">{t('seller.writeTitle', { name: seller.name })}</p>
            <ReviewForm
              submitLabel={t('reviews.submit')}
              onSubmit={async (review) => {
                await api.reviewSeller(seller.id, { ...review, listing_id: reviewListing });
                setThanks(true);
                load();
              }}
            >
              {canReview.length > 1 && (
                <select className="select" value={reviewListing} onChange={(event) => setReviewListing(event.target.value)} aria-label={t('seller.whichListing')}>
                  {canReview.map((l) => <option key={l.id} value={l.id}>{localized(l, 'title')}</option>)}
                </select>
              )}
              {canReview.length === 1 && <p className="small muted" style={{ margin: 0 }}>{t('seller.aboutListing', { title: localized(canReview[0], 'title') })}</p>}
            </ReviewForm>
          </div>
        )}
        {thanks && <div className="notice notice--positive">{t('seller.thanks')}</div>}

        {reviews.length ? (
          <ul className="review-list">
            {reviews.map((review) => <ReviewItem key={review.id} review={review} context={t('seller.reviewAbout', { title: localized(review, 'title') })} />)}
          </ul>
        ) : (
          <p className="muted">{t('seller.noReviews')}</p>
        )}
        <p className="small muted">{t('seller.howReviews')}</p>
      </section>
    </div>
  );
}
