import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useI18n } from '../i18n/index.jsx';
import { sessionApi } from '../lib/session-api.js';
import { formatPrice, formatRelative } from '../lib/format.js';
import { Avatar } from '../components/Avatar.jsx';
import { ListingImage } from '../components/ListingCard.jsx';
import { ErrorState } from '../components/States.jsx';
import { ArrowLeftIcon, SendIcon } from '../components/Icons.jsx';

export function Messages() {
  const { t } = useI18n();
  const { profile, loading, openSignIn } = useAuth();
  if (loading) return <div className="shell page"><p className="system-msg" role="status">{t('common.loading')}</p></div>;
  if (!profile) {
    return (
      <div className="shell gate">
        <h1>{t('messages.signInTitle')}</h1>
        <p>{t('messages.signInBody')}</p>
        <button type="button" className="btn btn--primary" onClick={openSignIn}>{t('auth.signIn')}</button>
      </div>
    );
  }
  return <Inbox key={profile.id} profile={profile} />;
}

function Inbox({ profile }) {
  const { t, lang, localized } = useI18n();
  const [params, setParams] = useSearchParams();
  const listingId = params.get('listing');
  const conversationId = params.get('conversation');
  const [threads, setThreads] = useState([]);
  const [status, setStatus] = useState('loading');
  const [startError, setStartError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    let active = true, timer;
    async function refresh() {
      try {
        const data = await sessionApi.inbox();
        if (active) { setThreads(data.conversations); setStatus('ready'); }
      } catch { if (active) setStatus('error'); }
      if (active) timer = setTimeout(refresh, 4000);
    }
    refresh();
    return () => { active = false; clearTimeout(timer); };
  }, [attempt]);

  useEffect(() => {
    if (!listingId) return;
    let active = true;
    setOpening(true);
    setStartError(null);
    sessionApi.start(listingId).then(({ conversation }) => {
      if (!active) return;
      setThreads((current) => [conversation, ...current.filter((item) => item.id !== conversation.id)]);
      setParams({ conversation: conversation.id }, { replace: true });
    }).catch((error) => {
      if (active) setStartError(error.message);
    }).finally(() => active && setOpening(false));
    return () => { active = false; };
  }, [listingId, attempt, setParams]);

  const startErrorText = startError === 'own_listing' ? 'messages.ownListing' : startError === 'seller_unavailable' ? 'messages.unavailable' : 'common.error';

  return (
    <div className="messages">
      <div className={`shell messages__inner${conversationId ? ' has-thread' : ''}`}>
        <aside className="inbox" aria-labelledby="inbox-title">
          <h1 id="inbox-title" className="inbox__title">{t('messages.inbox')}</h1>
          {startError && (
            <div className="notice notice--bad" role="alert">
              <p>{t(startErrorText)}</p>
              <button type="button" className="link-btn" onClick={() => setAttempt((value) => value + 1)}>{t('common.retry')}</button>
            </div>
          )}
          {opening && <p className="system-msg" role="status">{t('common.loading')}</p>}
          {status === 'loading' && <p className="system-msg" role="status">{t('common.loading')}</p>}
          {status === 'error' && <ErrorState onRetry={() => setAttempt((value) => value + 1)} />}
          {status === 'ready' && threads.length === 0 && !opening && (
            <div className="inbox__empty">
              <p>{t('messages.emptyTitle')}</p>
              <p className="muted small">{t('messages.emptyBody')}</p>
              <Link className="btn btn--small" to="/browse">{t('nav.browse')}</Link>
            </div>
          )}
          {threads.length > 0 && (
            <ul className="inbox__list">
              {threads.map((thread) => {
                const unread = thread.unread > 0 && thread.id !== conversationId;
                return (
                  <li key={thread.id}>
                    <Link
                      className={`inbox-item${unread ? ' inbox-item--unread' : ''}`}
                      aria-current={thread.id === conversationId ? 'page' : undefined}
                      to={`/messages?conversation=${thread.id}`}
                    >
                      <Avatar name={thread.other_name} />
                      <span className="inbox-item__text">
                        <span className="inbox-item__top">
                          <strong>{thread.other_name}</strong>
                          <time dateTime={thread.updated_at}>{formatRelative(thread.updated_at, lang)}</time>
                        </span>
                        <span className="inbox-item__listing">{localized(thread, 'title')}</span>
                        <span className="inbox-item__last">{thread.last_message || t('messages.startTitle')}</span>
                      </span>
                      {unread && <span className="count count--unread">{thread.unread}<span className="sr-only"> {t('messages.unread')}</span></span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {conversationId
          ? <Conversation key={conversationId} id={conversationId} profile={profile} />
          : (
            <section className="chat chat--placeholder" aria-label={t('messages.title')}>
              <p className="system-msg">{t(threads.length ? 'messages.selectThread' : 'messages.emptyBody')}</p>
            </section>
          )}
      </div>
    </div>
  );
}

function Conversation({ id, profile }) {
  const { t, localized, lang } = useI18n();
  const { refreshUnread } = useAuth();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('loading');
  const [hasOlder, setHasOlder] = useState(false);
  const [olderLoading, setOlderLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const scrollRef = useRef(null);
  const pending = useRef(null);
  const active = useRef(true);
  // Messages already on screen when the thread opened don't animate in.
  const firstLoaded = useRef(null);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  function merge(incoming) {
    setMessages((current) => [...new Map([...current, ...incoming].map((item) => [item.id, item])).values()].sort((a, b) => a.id - b.id));
  }

  useEffect(() => {
    let live = true, timer, cursor = 0, initialized = false;
    async function refresh() {
      try {
        const data = await sessionApi.messages(id, initialized ? { after: cursor } : {});
        if (!live) return;
        const box = scrollRef.current;
        const nearBottom = !box || box.scrollHeight - box.scrollTop - box.clientHeight < 100;
        setConversation(data.conversation);
        if (!initialized) {
          firstLoaded.current = new Set(data.messages.map((message) => message.id));
          setMessages(data.messages);
          setHasOlder(data.hasMore);
        } else merge(data.messages);
        const newest = Math.max(cursor, ...data.messages.map((message) => message.id));
        // Loading messages marks them read on the server; update the badge.
        if (!initialized || newest > cursor) refreshUnread();
        cursor = newest;
        initialized = true;
        setStatus('ready'); setRefreshError(false);
        if (nearBottom) requestAnimationFrame(() => { if (live && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; });
      } catch {
        if (live) { if (!initialized) setStatus('error'); else setRefreshError(true); }
      }
      if (live) timer = setTimeout(refresh, 3000);
    }
    refresh();
    return () => { live = false; clearTimeout(timer); };
  }, [id, attempt, refreshUnread]);

  async function older() {
    setOlderLoading(true);
    const box = scrollRef.current;
    const previousHeight = box?.scrollHeight || 0;
    const previousTop = box?.scrollTop || 0;
    try {
      const data = await sessionApi.messages(id, { before: messages[0].id });
      if (!active.current) return;
      data.messages.forEach((message) => firstLoaded.current?.add(message.id));
      merge(data.messages); setHasOlder(data.hasMore);
      requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = previousTop + scrollRef.current.scrollHeight - previousHeight; });
    } catch { if (active.current) setRefreshError(true); }
    finally { if (active.current) setOlderLoading(false); }
  }

  async function send(event) {
    event?.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    if (!pending.current || pending.current.body !== body) pending.current = { body, clientId: crypto.randomUUID() };
    setSending(true); setSendError(false);
    try {
      const { message } = await sessionApi.send(id, body, pending.current.clientId);
      if (!active.current) return;
      merge([message]); setDraft(''); pending.current = null;
      requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; });
    } catch { if (active.current) setSendError(true); }
    finally { if (active.current) setSending(false); }
  }

  // Enter sends, Shift+Enter adds a line. Never while a Vietnamese IME is still composing.
  function onKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && window.matchMedia('(pointer: fine)').matches) send(event);
  }

  if (status === 'loading') return <section className="chat"><p className="system-msg chat__loading" role="status">{t('common.loading')}</p></section>;
  if (status === 'error') return <section className="chat"><ErrorState onRetry={() => setAttempt((value) => value + 1)} /></section>;

  const time = (iso) => new Date(iso).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <section className="chat" aria-label={t('messages.title')}>
      <header className="chat__head">
        <Link to="/messages" className="icon-btn chat__back" aria-label={t('messages.inbox')}><ArrowLeftIcon /></Link>
        <Avatar name={conversation.other_name} />
        <div className="chat__who">
          <h2>{conversation.other_name}</h2>
          <p>{t('messages.privateNotice')}</p>
        </div>
      </header>

      <div className="chat__body" ref={scrollRef} role="log" aria-label={t('messages.title')} aria-live="polite" aria-relevant="additions">
        <Link className="chat__quote" to={`/listing/${conversation.listing_id}`}>
          <span className="chat__quote-photo"><ListingImage listing={conversation} alt="" /></span>
          <span className="chat__quote-text">
            <span className="chat__quote-label">{t('messages.contextLabel')}</span>
            <strong>{localized(conversation, 'title')}</strong>
            {conversation.price_vnd != null && <span className="num">{formatPrice(conversation.price_vnd, lang)}</span>}
          </span>
        </Link>
        {hasOlder && <button type="button" className="link-btn chat__older" onClick={older} disabled={olderLoading}>{t(olderLoading ? 'common.loading' : 'messages.older')}</button>}
        {messages.length === 0 && <p className="system-msg">{t('messages.startBody')}</p>}
        {messages.map((message) => {
          const mine = message.sender_id === profile.id;
          const fresh = firstLoaded.current && !firstLoaded.current.has(message.id);
          return (
            <div className={`msg${mine ? ' msg--mine' : ''}${fresh ? ' msg--new' : ''}`} key={message.id}>
              <p>{message.body}</p>
              <time dateTime={message.created_at}>{time(message.created_at)}</time>
            </div>
          );
        })}
      </div>

      <div className="chat__foot">
        {refreshError && <p className="chat__notice" role="status">{t('messages.refreshError')}</p>}
        {sendError && <p className="chat__notice field__error" role="alert">{t('messages.sendError')}</p>}
        <form className="chat__composer" onSubmit={send}>
          <label className="sr-only" htmlFor="message-draft">{t('messages.placeholder')}</label>
          <textarea id="message-draft" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown} disabled={sending} maxLength={2000} placeholder={t('messages.placeholder')} rows={1} />
          <button type="submit" className="chat__send" disabled={sending || !draft.trim()} aria-label={t(sending ? 'messages.sending' : 'messages.send')}>
            <SendIcon />
          </button>
        </form>
      </div>
    </section>
  );
}
