import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { formatDateTime } from '../lib/format.js';
import { AdminBadge } from './Reviews.jsx';

const QUICK = ['commentsQuickAvailable', 'commentsQuickPrice', 'commentsQuickTake', 'commentsQuickPickup'];

/** The admin's own tab can remove any comment (it holds the admin session). */
const adminToken = () => {
  try { return sessionStorage.getItem('vong.admin.token') || ''; } catch { return ''; }
};

/**
 * Public questions under a listing ("còn không bạn?"), so buyers see others are
 * interested. Private chat stays the place to agree on price and pickup.
 */
export function Comments({ listing }) {
  const { t, lang } = useI18n();
  const { profile, openSignIn } = useAuth();
  const [comments, setComments] = useState(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const isSeller = Boolean(profile && profile.id === listing.seller_id);
  const open = listing.status === 'published';

  const load = useCallback(() => {
    api.comments(listing.id).then((data) => setComments(data.comments)).catch(() => setComments([]));
  }, [listing.id]);
  useEffect(load, [load, profile?.id]);

  const send = async (text) => {
    const value = String(text ?? body).trim();
    if (!value) return;
    if (!profile) { openSignIn(); return; }
    setSending(true);
    setError('');
    try {
      await api.postComment(listing.id, value);
      setBody('');
      load();
    } catch (err) {
      setError(err.payload?.error === 'too_many_comments' ? t('listing.commentsLimit') : t('common.error'));
    } finally {
      setSending(false);
    }
  };

  const remove = async (comment) => {
    try {
      if (comment.can_delete) await api.deleteComment(listing.id, comment.id);
      else await api.admin.deleteComment(adminToken(), comment.id);
      load();
    } catch { setError(t('common.error')); }
  };

  return (
    <section className="comments" id="comments" aria-labelledby="comments-title">
      <h2 id="comments-title">
        {t('listing.commentsTitle')}{comments?.length ? <span className="muted"> · {comments.length}</span> : null}
      </h2>

      {comments === null ? (
        <p className="small muted">{t('common.loading')}</p>
      ) : comments.length === 0 ? (
        <p className="small muted">{open ? t('listing.commentsEmpty') : t('listing.commentsNone')}</p>
      ) : (
        <ul className="comment-list">
          {comments.map((comment) => (
            <li key={comment.id} className={`comment${comment.seller ? ' comment--seller' : ''}`}>
              <div className="comment__head">
                <strong>{comment.author}</strong>
                {comment.seller && <span className="comment__tag">{t('listing.commentsSeller')}</span>}
                {comment.admin && <AdminBadge small />}
                <span className="small muted">{formatDateTime(comment.created_at, lang)}</span>
                {(comment.can_delete || adminToken()) && (
                  <button type="button" className="link-quiet small comment__delete" onClick={() => remove(comment)}>{t('listing.commentsDelete')}</button>
                )}
              </div>
              <p className="comment__body">{comment.body}</p>
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <form className="comment-form" onSubmit={(event) => { event.preventDefault(); send(); }}>
          {!isSeller && (
            <div className="chip-row comment-form__quick">
              {QUICK.map((key) => (
                <button key={key} type="button" className="chip" disabled={sending} onClick={() => send(t(`listing.${key}`))}>{t(`listing.${key}`)}</button>
              ))}
            </div>
          )}
          <div className="comment-form__row">
            <textarea
              className="textarea"
              rows={2}
              maxLength={500}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onFocus={() => !profile && openSignIn()}
              placeholder={isSeller ? t('listing.commentsReplyPlaceholder') : t('listing.commentsPlaceholder')}
              aria-label={t('listing.commentsTitle')}
            />
            <button type="submit" className="btn" disabled={sending || !body.trim()}>{t('listing.commentsSend')}</button>
          </div>
          {error && <p className="small" role="alert" style={{ margin: 0 }}>{error}</p>}
          <p className="small muted" style={{ margin: 0 }}>{profile ? t('listing.commentsHint') : t('listing.commentsSignIn')}</p>
        </form>
      ) : (
        listing.status === 'sold' && <p className="small muted">{t('listing.commentsClosed')}</p>
      )}
    </section>
  );
}
