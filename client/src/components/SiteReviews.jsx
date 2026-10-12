import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { ReviewForm, ReviewItem, Stars } from './Reviews.jsx';

/**
 * Home page: what people say about Vòng. Only reviews the owner approved are
 * shown; with none yet, it simply invites the first one. No placeholder reviews.
 */
export function SiteReviews() {
  const { t } = useI18n();
  const { profile, openSignIn } = useAuth();
  const [data, setData] = useState(null);
  const [writing, setWriting] = useState(false);
  const [sent, setSent] = useState(false);

  const load = useCallback(() => {
    api.siteReviews().then(setData).catch(() => setData(null));
  }, []);
  useEffect(load, [load, profile?.id]);

  if (!data) return null;
  const mine = data.mine;

  return (
    <section className="site-reviews" aria-labelledby="site-reviews-title">
      <div className="market-section-head">
        <h2 id="site-reviews-title">{t('reviews.siteTitle')}</h2>
        {data.count > 0 && (
          <p className="site-reviews__score">
            <Stars value={data.average} /> <strong>{data.average}</strong>
            <span className="muted">{t('seller.reviewCount', { n: data.count })}</span>
          </p>
        )}
      </div>

      {data.count > 0 ? (
        <ul className="review-list review-list--grid">
          {data.reviews.map((review) => <ReviewItem key={review.id} review={review} />)}
        </ul>
      ) : (
        <p className="muted">{t('reviews.siteEmpty')}</p>
      )}

      {sent || mine?.status === 'pending' ? (
        <div className="notice notice--positive" style={{ marginTop: 16 }}>{t('reviews.sitePending')}</div>
      ) : writing ? (
        <div className="card panel review-box" style={{ marginTop: 16 }}>
          <ReviewForm
            initial={mine}
            submitLabel={t('reviews.submit')}
            onSubmit={async (review) => {
              await api.postSiteReview(review);
              setSent(true);
            }}
          />
        </div>
      ) : (
        <button
          type="button"
          className="btn btn--ghost"
          style={{ marginTop: 16 }}
          onClick={() => (profile ? setWriting(true) : openSignIn())}
        >
          {mine ? t('reviews.siteEdit') : t('reviews.siteWrite')}
        </button>
      )}
    </section>
  );
}
