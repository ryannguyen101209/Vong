import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useI18n } from '../i18n/index.jsx';
import { sessionApi } from '../lib/session-api.js';
import { EmptyState, ErrorState } from '../components/States.jsx';

export function Messages() {
  const { t } = useI18n();
  const { profile, loading, openSignIn } = useAuth();
  if (loading) return <div className="shell section"><p role="status">{t('common.loading')}</p></div>;
  if (!profile) return (
    <div className="shell section messages-gate">
      <h1>{t('messages.signInTitle')}</h1><p className="lead">{t('messages.signInBody')}</p>
      <button className="btn btn--accent" onClick={openSignIn}>{t('auth.signIn')}</button>
    </div>
  );
  return <Inbox key={profile.id} profile={profile} />;
}

function Inbox({ profile }) {
  const { t, localized } = useI18n();
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

  return (
    <div className="shell section messages-page">
      <h1>{t('messages.inbox')}</h1>
      {startError && <div className="notice" role="alert"><p>{t(startError === 'own_listing' ? 'messages.ownListing' : startError === 'seller_unavailable' ? 'messages.unavailable' : 'common.error')}</p><button className="link-quiet" onClick={() => setAttempt((value) => value + 1)}>{t('common.retry')}</button></div>}
      {opening && <p role="status">{t('common.loading')}</p>}
      <div className="inbox-layout">
        <nav className="thread-list" aria-label={t('messages.inbox')}>
          {status === 'loading' && <p role="status">{t('common.loading')}</p>}
          {status === 'error' && <ErrorState onRetry={() => setAttempt((value) => value + 1)} />}
          {status === 'ready' && threads.length === 0 && <p className="muted">{t('messages.emptyBody')}</p>}
          {threads.map((thread) => (
            <Link className="thread-link" aria-current={thread.id === conversationId ? 'page' : undefined} to={'/messages?conversation=' + thread.id} key={thread.id}>
              <strong>{thread.other_name}</strong><span>{localized(thread, 'title')}</span>
              <small>{thread.last_message || t('messages.startTitle')}</small>
            </Link>
          ))}
        </nav>
        {conversationId
          ? <Conversation key={conversationId} id={conversationId} profile={profile} />
          : <EmptyState title={t(threads.length ? 'messages.selectThread' : 'messages.emptyTitle')} body={t('messages.emptyBody')}><Link className="btn btn--ghost" to="/browse">{t('nav.browse')}</Link></EmptyState>}
      </div>
    </div>
  );
}

function Conversation({ id, profile }) {
  const { t, localized, lang } = useI18n();
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
        if (!initialized) { setMessages(data.messages); setHasOlder(data.hasMore); }
        else merge(data.messages);
        cursor = Math.max(cursor, ...data.messages.map((message) => message.id));
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
  }, [id, attempt]);

  async function older() {
    setOlderLoading(true);
    const box = scrollRef.current;
    const previousHeight = box?.scrollHeight || 0;
    const previousTop = box?.scrollTop || 0;
    try {
      const data = await sessionApi.messages(id, { before: messages[0].id });
      if (!active.current) return;
      merge(data.messages); setHasOlder(data.hasMore);
      requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = previousTop + scrollRef.current.scrollHeight - previousHeight; });
    } catch { if (active.current) setRefreshError(true); }
    finally { if (active.current) setOlderLoading(false); }
  }

  async function send(event) {
    event.preventDefault();
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

  if (status === 'loading') return <p role="status">{t('common.loading')}</p>;
  if (status === 'error') return <ErrorState onRetry={() => setAttempt((value) => value + 1)} />;
  return (
    <section className="conversation" aria-label={t('messages.title')}>
      <header className="conversation__header">
        <div><h2>{conversation.other_name}</h2><Link to={'/listing/' + conversation.listing_id}>{localized(conversation, 'title')}</Link><p>{t('messages.privateNotice')}</p></div>
      </header>
      <div className="conversation__body" ref={scrollRef} role="log" aria-label={t('messages.title')} aria-live="polite" aria-relevant="additions">
        {hasOlder && <button className="link-quiet" onClick={older} disabled={olderLoading}>{t(olderLoading ? 'common.loading' : 'messages.older')}</button>}
        {messages.length === 0 && <div className="conversation__starter"><h3>{t('messages.startTitle')}</h3><p>{t('messages.startBody')}</p></div>}
        {messages.map((message) => <div className={'message-bubble' + (message.sender_id === profile.id ? '' : ' message-bubble--received')} key={message.id}><p>{message.body}</p><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time></div>)}
      </div>
      <div>
        {refreshError && <p className="conversation__notice" role="status">{t('messages.refreshError')}</p>}
        {sendError && <p className="conversation__notice field__error" role="alert">{t('messages.sendError')}</p>}
        <form className="composer" onSubmit={send}>
          <label className="sr-only" htmlFor="message-draft">{t('messages.placeholder')}</label>
          <textarea id="message-draft" value={draft} onChange={(event) => setDraft(event.target.value)} disabled={sending} maxLength={2000} placeholder={t('messages.placeholder')} rows={2} />
          <button className="btn btn--accent" disabled={sending || !draft.trim()}>{t(sending ? 'messages.sending' : 'messages.send')}</button>
        </form>
      </div>
    </section>
  );
}
