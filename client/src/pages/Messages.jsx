import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useI18n } from '../i18n/index.jsx';
import { api } from '../lib/api.js';
import { ListingImage } from '../components/ListingCard.jsx';
import { MessageIcon } from '../components/Icons.jsx';

const STORAGE_KEY = 'vong.message.prototype';

function loadThreads() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function Messages() {
  const { t, localized } = useI18n();
  const { profile, openSignIn } = useAuth();
  const [params] = useSearchParams();
  const listingId = params.get('listing');
  const [listing, setListing] = useState(null);
  const [threads, setThreads] = useState(loadThreads);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (!listingId) return;
    api.listing(listingId, { countView: false }).then(({ listing: item }) => setListing(item)).catch(() => {});
  }, [listingId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
  }, [threads]);

  const messages = useMemo(() => threads[listingId] || [], [threads, listingId]);

  const send = (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !listingId) return;
    setThreads((current) => ({
      ...current,
      [listingId]: [...(current[listingId] || []), { id: crypto.randomUUID(), body, createdAt: new Date().toISOString() }],
    }));
    setDraft('');
  };

  if (!profile) {
    return (
      <div className="shell section messages-gate editorial-page messages-page">
        <div className="messages-gate__icon"><MessageIcon size={28} /></div>
        <h1>{t('messages.signInTitle')}</h1>
        <p className="lead">{t('messages.signInBody')}</p>
        <button type="button" className="btn btn--accent" onClick={openSignIn}>{t('auth.signIn')}</button>
      </div>
    );
  }

  if (!listingId) {
    return (
      <div className="shell section messages-gate editorial-page messages-page">
        <div className="messages-gate__icon"><MessageIcon size={28} /></div>
        <h1>{t('messages.emptyTitle')}</h1>
        <p className="lead">{t('messages.emptyBody')}</p>
        <Link to="/browse" className="btn btn--ghost">{t('nav.browse')}</Link>
      </div>
    );
  }

  return (
    <div className="shell section editorial-page messages-page">
      <div className="message-layout">
        <aside className="message-context">
          <p className="eyebrow">{t('messages.contextLabel')}</p>
          {listing ? (
            <>
              <div className="message-context__media"><ListingImage listing={listing} alt={localized(listing, 'title')} /></div>
              <h2>{localized(listing, 'title')}</h2>
              <p className="muted">{t('messages.sellerLabel', { name: listing.seller_name })}</p>
              <Link to={`/listing/${listing.id}`} className="link-quiet">{t('messages.viewListing')}</Link>
            </>
          ) : <p className="muted">{t('common.loading')}</p>}
        </aside>

        <section className="conversation" aria-label={t('messages.title')}>
          <header className="conversation__header">
            <div>
              <h1>{t('messages.title')}</h1>
              <p>{t('messages.prototypeNotice')}</p>
            </div>
            <span className="prototype-badge">{t('messages.prototypeBadge')}</span>
          </header>

          <div className="conversation__body" aria-live="polite">
            {messages.length === 0 ? (
              <div className="conversation__starter">
                <MessageIcon size={30} />
                <h2>{t('messages.startTitle')}</h2>
                <p>{t('messages.startBody')}</p>
              </div>
            ) : messages.map((message) => (
              <div className="message-bubble" key={message.id}>
                <p>{message.body}</p>
                <time>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
              </div>
            ))}
          </div>

          <form className="composer" onSubmit={send}>
            <label className="sr-only" htmlFor="message-draft">{t('messages.placeholder')}</label>
            <textarea
              id="message-draft"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={t('messages.placeholder')}
              rows="2"
            />
            <button type="submit" className="btn btn--accent" disabled={!draft.trim()}>{t('messages.send')}</button>
          </form>
        </section>
      </div>
    </div>
  );
}
