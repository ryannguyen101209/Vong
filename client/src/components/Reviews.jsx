import { useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { formatDate } from '../lib/format.js';

/** Five stars, filled up to the rating. Read-only. */
export function Stars({ value, size = 16 }) {
  const { t } = useI18n();
  const rounded = Math.round(Number(value) || 0);
  return (
    <span className="stars" role="img" aria-label={t('reviews.starsLabel', { n: Number(value).toFixed(1).replace(/\.0$/, '') })} style={{ fontSize: size }}>
      {[1, 2, 3, 4, 5].map((n) => <span key={n} className={n <= rounded ? 'stars__on' : 'stars__off'} aria-hidden="true">★</span>)}
    </span>
  );
}

/** Pick 1 to 5 stars. */
export function StarInput({ value, onChange }) {
  const { t } = useI18n();
  return (
    <div className="star-input" role="radiogroup" aria-label={t('reviews.ratingLabel')}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={t('reviews.starsLabel', { n })}
          className={n <= value ? 'is-on' : ''}
          onClick={() => onChange(n)}
        >★</button>
      ))}
    </div>
  );
}

/** "Người bán uy tín" pill, given by the owner by hand. */
export function TrustedBadge({ small = false }) {
  const { t } = useI18n();
  return (
    <span className={`trusted-badge${small ? ' trusted-badge--small' : ''}`} title={t('reviews.trustedHint')}>
      <span aria-hidden="true">✓</span> {t('reviews.trusted')}
    </span>
  );
}

/** "Admin" pill: this account belongs to the Vòng team. Switched on by hand in the admin panel. */
export function AdminBadge({ small = false }) {
  const { t } = useI18n();
  return (
    <span className={`admin-badge${small ? ' admin-badge--small' : ''}`} title={t('reviews.adminHint')}>
      <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true" focusable="false"><path d="M8 1 2.5 3v4.2c0 3.4 2.3 6.3 5.5 7.3 3.2-1 5.5-3.9 5.5-7.3V3L8 1Z" fill="currentColor" /></svg>
      {t('reviews.admin')}
    </span>
  );
}

/** One review: stars, who, when, and what they wrote. */
export function ReviewItem({ review, context }) {
  const { lang } = useI18n();
  return (
    <li className="review">
      <div className="review__head">
        <Stars value={review.rating} size={14} />
        <span className="small muted">{review.reviewer} · {formatDate(review.created_at, lang)}</span>
        {review.admin && <AdminBadge small />}
      </div>
      <p className="review__body">{review.body}</p>
      {context && <p className="small muted review__context">{context}</p>}
    </li>
  );
}

/** Stars plus a comment, then send. Used for both seller reviews and reviews of Vòng. */
export function ReviewForm({ onSubmit, initial, children, submitLabel }) {
  const { t } = useI18n();
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [body, setBody] = useState(initial?.body ?? '');
  const [state, setState] = useState('idle');

  const submit = async (event) => {
    event.preventDefault();
    setState('sending');
    try {
      await onSubmit({ rating, body: body.trim() });
      setState('sent');
    } catch {
      setState('error');
    }
  };

  if (state === 'sent') return null;
  return (
    <form className="review-form" onSubmit={submit}>
      {children}
      <StarInput value={rating} onChange={setRating} />
      <textarea
        className="input"
        rows={3}
        maxLength={1000}
        value={body}
        placeholder={t('reviews.bodyPlaceholder')}
        aria-label={t('reviews.bodyLabel')}
        onChange={(event) => setBody(event.target.value)}
      />
      {state === 'error' && <p role="alert" className="field__error">{t('reviews.error')}</p>}
      <button type="submit" className="btn btn--accent btn--small" disabled={!rating || body.trim().length < 5 || state === 'sending'}>
        {state === 'sending' ? t('reviews.sending') : submitLabel}
      </button>
    </form>
  );
}
