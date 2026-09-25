import { Fragment, useCallback, useEffect, useId, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { api } from '../lib/api.js';
import { formatPrice, formatDateTime, digitsOnly } from '../lib/format.js';
import { Field } from '../components/Field.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { EmptyState, LoadingFeed } from '../components/States.jsx';
import { ListingImage } from '../components/ListingCard.jsx';

// sessionStorage, not localStorage: closing the tab should end the admin session.
const TOKEN_KEY = 'vong.admin.token';

const STATUS_ORDER = ['awaiting_approval', 'approved', 'published', 'pending_payment', 'rejected'];
const STATUS_TONE = { awaiting_approval: 'wait', approved: 'info', published: 'ok', pending_payment: 'none', rejected: 'bad' };

function readToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

/** The admin wording for a status. "Approved" means the seller still has to enter the key. */
function statusLabel(t, key) {
  return t(key === 'approved' ? 'admin.statusApproved' : `status.${key}`);
}

/**
 * Fills the {{slots}} of a translated sentence with elements, so the amount and
 * reference can stand out in either language's word order.
 */
function richText(template, parts) {
  return template.split(/(\{\{\w+\}\})/g).map((piece, index) => {
    const name = piece.match(/^\{\{(\w+)\}\}$/)?.[1];
    return name && parts[name] !== undefined ? <Fragment key={index}>{parts[name]}</Fragment> : piece;
  });
}

function LoginForm({ onSuccess }) {
  const { t } = useI18n();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(false);
    try {
      const session = await api.admin.login(password);
      try {
        sessionStorage.setItem(TOKEN_KEY, session.token);
      } catch {
        /* Session storage can be blocked; the token still works in memory. */
      }
      onSuccess(session.token);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="shell gate admin-login">
      <h1>{t('admin.loginTitle')}</h1>
      <p>{t('admin.loginBody')}</p>

      <form className="form" onSubmit={submit}>
        <Field label={t('admin.passwordLabel')} error={error ? t('admin.loginError') : undefined}>
          {(props) => (
            <input
              {...props}
              className="input"
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
            />
          )}
        </Field>
        <button type="submit" className="btn btn--primary btn--block" disabled={busy || !password}>
          {busy ? t('admin.loggingIn') : t('admin.login')}
        </button>
      </form>
    </div>
  );
}

function RejectDialog({ onClose, onSubmit }) {
  const { t } = useI18n();
  const titleId = useId();
  const [reason, setReason] = useState('');
  const presets = [
    'rejectPresetNoPayment',
    'rejectPresetWrongAmount',
    'rejectPresetProhibited',
    'rejectPresetQuality',
  ];

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog reject-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>{t('admin.rejectTitle')}</h2>
        <p className="reject-dialog__lead">{t('admin.rejectLead')}</p>

        <div className="chip-row reject-dialog__presets">
          {presets.map((key) => {
            const text = t(`admin.${key}`);
            return (
              <button key={key} type="button" className="chip" aria-pressed={reason === text} onClick={() => setReason(text)}>
                {text}
              </button>
            );
          })}
        </div>

        <textarea
          className="textarea reject-dialog__reason"
          rows={3}
          value={reason}
          maxLength={500}
          aria-labelledby={titleId}
          placeholder={t('admin.rejectPlaceholder')}
          onChange={(event) => setReason(event.target.value)}
        />

        <div className="reject-dialog__actions">
          <button type="button" className="btn" onClick={onClose}>{t('common.cancel')}</button>
          <button
            type="button"
            className="btn btn--danger"
            disabled={reason.trim().length < 3}
            onClick={() => onSubmit(reason.trim())}
          >
            {t('admin.rejectSubmit')}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Builds a mailto: link with the key or rejection message filled in, for when
 * the server could not email it itself. This opens a draft in the admin's own
 * mail app.
 */
function sellerMailto({ listing, action, reason, title, key, link, t }) {
  const name = action === 'approve' ? 'Key' : 'Rejected';
  const vars = {
    name: listing.seller_name,
    title,
    ref: listing.ref,
    reason: reason || listing.reject_reason || '—',
    key,
    url: link || `${window.location.origin}/payment/${listing.id}`,
  };
  const subject = t(`admin.email${name}Subject`, vars);
  const body = t(`admin.email${name}Body`, vars);
  return `mailto:${encodeURIComponent(listing.seller_email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** What happened after Approve / Resend key, including a key to pass on by hand. */
function KeyResult({ listing, result }) {
  const { t, localized } = useI18n();
  const title = localized(listing, 'title');
  if (result.delivery === 'sent') {
    return (
      <div className="admin-result" role="status">
        <p className="admin-result__title">{t('admin.actionedApproved', { title })}</p>
        <p className="admin-result__body">{t('admin.keyEmailed', { email: result.sent_to })}</p>
      </div>
    );
  }
  const failed = result.delivery === 'failed';
  return (
    <div className="admin-result" role="status">
      <p className="admin-result__title">{t('admin.actionedApproved', { title })}</p>
      <p className={`admin-result__body${failed ? ' admin-result__body--bad' : ''}`}>
        {t(failed ? 'admin.keyMailFailed' : 'admin.keyNotEmailed', { email: result.sent_to })}
      </p>
      <div className="admin-key">
        <span className="admin-key__value">{result.key}</span>
        <div className="admin-key__actions">
          <CopyText value={result.key} />
          <a className="btn btn--primary" href={sellerMailto({ listing, action: 'approve', title, key: result.key, link: result.link, t })}>
            {t('admin.emailSeller')}
          </a>
        </div>
      </div>
    </div>
  );
}

function CopyText({ value }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* The key is on screen anyway. */
    }
  };
  return <button type="button" className="btn" onClick={copy}>{copied ? t('common.copied') : t('common.copy')}</button>;
}

function Queue({ token, onAuthError }) {
  const { t, lang, localized } = useI18n();
  const [listings, setListings] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  // What you just did, so the seller can be emailed at the moment it happens.
  const [lastAction, setLastAction] = useState(null);
  const [actionError, setActionError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.admin
      .listings(token, 'awaiting_approval')
      .then((data) => {
        setListings(data.listings);
        setCounts(data.counts);
      })
      .catch((error) => error.status === 401 && onAuthError())
      .finally(() => setLoading(false));
  }, [token, onAuthError]);

  useEffect(load, [load]);

  const act = async (id, action, reason) => {
    const listing = listings.find((item) => item.id === id);
    setBusyId(id);
    setActionError(false);
    try {
      const result = action === 'approve'
        ? await api.admin.approve(token, id)
        : await api.admin.reject(token, id, reason);
      setRejecting(null);
      setLastAction({ listing, action, reason, result });
      load();
    } catch (error) {
      if (error.status === 401) onAuthError();
      else setActionError(true);
    } finally {
      setBusyId(null);
    }
  };

  const hasCounts = Object.keys(counts).length > 0;

  return (
    <div className="admin-split">
      <section className="admin-split__main" aria-label={t('admin.tabQueue')}>
        <p className="admin-lead">{t('admin.queueLead')}</p>

        {actionError && <p className="notice notice--bad" role="alert">{t('common.error')}</p>}

        {lastAction?.action === 'approve' && (
          <KeyResult listing={lastAction.listing} result={lastAction.result} />
        )}

        {lastAction?.action === 'reject' && (
          <div className="admin-result admin-result--bad" role="status">
            <p className="admin-result__title">
              {t('admin.actionedRejected', { title: localized(lastAction.listing, 'title') })}
            </p>
            {lastAction.result.delivery === 'sent' ? (
              <p className="admin-result__body">{t('admin.rejectEmailed')}</p>
            ) : lastAction.listing.seller_email ? (
              <>
                <p className="admin-result__body">{t('admin.mailDraftHint')}</p>
                <a
                  className="btn admin-result__action"
                  href={sellerMailto({
                    listing: lastAction.listing,
                    action: 'reject',
                    reason: lastAction.reason,
                    title: localized(lastAction.listing, 'title'),
                    t,
                  })}
                >
                  {t('admin.emailSeller')}
                </a>
              </>
            ) : (
              <p className="admin-result__body">{t('admin.noSellerEmail')}</p>
            )}
          </div>
        )}

        {loading ? (
          <LoadingFeed count={2} />
        ) : listings.length === 0 ? (
          <EmptyState title={t('admin.queueEmptyTitle')} body={t('admin.queueEmptyBody')} />
        ) : (
          <ol className="feed queue">
            {listings.map((listing) => {
              const noEmailId = `no-email-${listing.id}`;
              return (
                <li className="post queue-item" key={listing.id}>
                  <Avatar name={listing.seller_name} />
                  <div className="post__body">
                    <p className="post__meta">
                      <strong>{listing.seller_name}</strong>
                      <span>{t(`districts.${listing.district}`)}</span>
                    </p>

                    <div className="bubble queue-item__bubble">
                      <div className="queue-item__listing">
                        <div className="queue-item__thumb">
                          <ListingImage listing={listing} alt="" />
                        </div>
                        <div className="queue-item__text">
                          <h2 className="queue-item__title">{localized(listing, 'title')}</h2>
                          <p className="queue-item__price">{formatPrice(listing.price_vnd, lang)}</p>
                          <p className="queue-item__contact">
                            <span className="num">{listing.seller_phone}</span>
                            {listing.seller_email && (
                              <a href={`mailto:${listing.seller_email}`}>{listing.seller_email}</a>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="queue-item__check">
                        <p>
                          {richText(t('admin.expectedAmount'), {
                            amount: <strong>{formatPrice(listing.fee_vnd, lang)}</strong>,
                            ref: <strong className="queue-item__ref">{listing.ref}</strong>,
                          })}
                        </p>
                        <p className="queue-item__when">
                          {richText(t('admin.sellerClaims'), {
                            when: <span className="queue-item__time">{formatDateTime(listing.paid_marked_at, lang)}</span>,
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="queue-item__actions">
                      <button
                        type="button"
                        className="btn btn--primary"
                        disabled={busyId === listing.id || !listing.seller_email}
                        aria-describedby={listing.seller_email ? undefined : noEmailId}
                        onClick={() => act(listing.id, 'approve')}
                      >
                        {busyId === listing.id ? t('admin.approving') : t('admin.approve')}
                      </button>
                      <button
                        type="button"
                        className="btn btn--danger"
                        disabled={busyId === listing.id}
                        onClick={() => setRejecting(listing.id)}
                      >
                        {t('admin.reject')}
                      </button>
                    </div>
                    {!listing.seller_email && (
                      <p className="queue-item__note" id={noEmailId}>{t('admin.noSellerEmail')}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {hasCounts && (
        <aside className="admin-rail" aria-labelledby="admin-counts-title">
          <section className="admin-rail__block">
            <h2 id="admin-counts-title">{t('admin.tabAll')}</h2>
            <ul className="admin-counts">
              {STATUS_ORDER.map((key) => (
                <li key={key}>
                  <span className={`status status--${STATUS_TONE[key]}`}>{statusLabel(t, key)}</span>
                  <span className="num">{counts[key] ?? 0}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      )}

      {rejecting && (
        <RejectDialog
          onClose={() => setRejecting(null)}
          onSubmit={(reason) => act(rejecting, 'reject', reason)}
        />
      )}
    </div>
  );
}

function AllListings({ token, onAuthError }) {
  const { t, lang, localized } = useI18n();
  const filterId = useId();
  const [status, setStatus] = useState('published');
  const [listings, setListings] = useState([]);
  const [resent, setResent] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    setResent(null);
    api.admin
      .listings(token, status)
      .then((data) => setListings(data.listings))
      .catch((error) => error.status === 401 && onAuthError());
  }, [token, status, onAuthError]);

  const resendKey = async (listing) => {
    setBusyId(listing.id);
    try {
      setResent({ listing, result: await api.admin.resendKey(token, listing.id) });
    } catch (error) {
      if (error.status === 401) onAuthError();
      else setResent({ listing, error: true });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="admin-all" aria-label={t('admin.tabAll')}>
      <div className="admin-filter">
        <label className="admin-filter__label" htmlFor={filterId}>{t('admin.statusFilter')}</label>
        <select id={filterId} className="select" value={status} onChange={(event) => setStatus(event.target.value)}>
          {['published', 'approved', 'awaiting_approval', 'pending_payment', 'rejected'].map((key) => (
            <option key={key} value={key}>{statusLabel(t, key)}</option>
          ))}
        </select>
      </div>

      {status === 'approved' && <p className="admin-lead">{t('admin.approvedLead')}</p>}
      {resent && (
        resent.error
          ? <p className="notice notice--bad" role="alert">{t('common.error')}</p>
          : <KeyResult listing={resent.listing} result={resent.result} />
      )}

      {listings.length === 0 ? (
        <p className="system-msg admin-all__empty">{t('admin.filterEmpty')}</p>
      ) : (
        <div className="admin-table-wrap" role="region" aria-label={t('admin.tabAll')} tabIndex={0}>
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">{t('admin.colListing')}</th>
                <th scope="col">{t('listing.reference')}</th>
                <th scope="col" className="is-num">{t('admin.colPrice')}</th>
                <th scope="col">{t('listing.district')}</th>
                <th scope="col" className="is-num">{t('listing.views')}</th>
                <th scope="col">{t('listing.posted')}</th>
                {status === 'approved' && <th scope="col">{t('admin.keyColumn')}</th>}
              </tr>
            </thead>
            <tbody>
              {listings.map((listing) => (
                <tr key={listing.id}>
                  <td className="admin-table__title">
                    <a href={`/listing/${listing.id}`}>{localized(listing, 'title')}</a>
                    {listing.reject_reason && (
                      <p className="admin-table__reason">{listing.reject_reason}</p>
                    )}
                  </td>
                  <td className="admin-table__ref">{listing.ref}</td>
                  <td className="is-num">{formatPrice(listing.price_vnd, lang)}</td>
                  <td className="nowrap">{t(`districts.${listing.district}`)}</td>
                  <td className="is-num">{listing.views}</td>
                  <td className="nowrap">{formatDateTime(listing.created_at, lang)}</td>
                  {status === 'approved' && (
                    <td className="admin-table__key">
                      <span>{t('admin.keySentAt', { when: formatDateTime(listing.publish_key_sent_at, lang) })}</span>
                      <button type="button" className="link-btn" disabled={busyId === listing.id} onClick={() => resendKey(listing)}>
                        {busyId === listing.id ? t('key.resending') : t('admin.resendKey')}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Settings({ token, onAuthError }) {
  const { t, lang } = useI18n();
  const [banks, setBanks] = useState([]);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [messages, setMessages] = useState([]);
  const [mailConfigured, setMailConfigured] = useState(null);

  useEffect(() => {
    api.admin
      .settings(token)
      .then((data) => {
        setBanks(data.banks);
        setForm(data.settings);
        setMailConfigured(Boolean(data.mail_configured));
      })
      .catch((error) => error.status === 401 && onAuthError());
    api.admin.messages(token).then((data) => setMessages(data.messages)).catch(() => {});
  }, [token, onAuthError]);

  if (!form) return <p className="system-msg" role="status">{t('common.loading')}</p>;

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const data = await api.admin.saveSettings(token, {
        bank_bin: form.bank_bin,
        account_number: form.account_number,
        account_holder: form.account_holder,
        fee_vnd: form.fee_vnd,
      });
      setForm(data.settings);
      setMessage('saved');
    } catch (error) {
      if (error.status === 401) onAuthError();
      setMessage('error');
    } finally {
      setSaving(false);
    }
  };

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  return (
    <div className="admin-split admin-split--settings">
      <section className="admin-split__main" aria-label={t('admin.tabSettings')}>
        <p className="admin-lead">{t('admin.settingsBody')}</p>

        <form className="form admin-form" onSubmit={save}>
          <Field label={t('admin.bankLabel')}>
            {(props) => (
              <select {...props} className="select" value={form.bank_bin} onChange={set('bank_bin')}>
                {banks.map((bank) => (
                  <option key={bank.bin} value={bank.bin}>{bank.name} ({bank.bin})</option>
                ))}
              </select>
            )}
          </Field>

          <div className="form-grid">
            <Field label={t('admin.accountNumberLabel')}>
              {(props) => (
                <input {...props} className="input num" value={form.account_number} onChange={set('account_number')} />
              )}
            </Field>

            <Field label={t('admin.accountHolderLabel')} hint={t('admin.holderHint')}>
              {(props) => (
                <input
                  {...props}
                  className="input"
                  value={form.account_holder}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, account_holder: event.target.value.toUpperCase() }))
                  }
                />
              )}
            </Field>
          </div>

          <div className="admin-form__fee">
            <Field label={t('admin.feeLabel')} hint={t('admin.feeHint')}>
              {(props) => (
                <input
                  {...props}
                  className="input num"
                  inputMode="numeric"
                  value={form.fee_vnd}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, fee_vnd: digitsOnly(event.target.value) }))
                  }
                />
              )}
            </Field>
          </div>

          {message && (
            <p className={`notice notice--${message === 'saved' ? 'ok' : 'bad'}`} role="status">
              {message === 'saved' ? t('admin.settingsSaved') : t('admin.settingsError')}
            </p>
          )}

          <button type="submit" className="btn btn--primary admin-form__submit" disabled={saving}>
            {saving ? t('admin.savingSettings') : t('admin.saveSettings')}
          </button>
        </form>
      </section>

      <aside className="admin-rail">
        <section className="admin-rail__block">
          <h2 className={`admin-state admin-state--${mailConfigured ? 'ok' : 'wait'}`}>
            {t(mailConfigured ? 'admin.mailOnTitle' : 'admin.mailOffTitle')}
          </h2>
          <p>{t(mailConfigured ? 'admin.mailOnBody' : 'admin.mailOffBody')}</p>
        </section>
        <section className="admin-rail__block">
          <h2>{t('admin.qrCheckTitle')}</h2>
          <p>{t('admin.qrCheckBody')}</p>
        </section>
      </aside>

      <section className="admin-inbox" aria-labelledby="admin-inbox-title">
        <h2 id="admin-inbox-title">{t('admin.messagesTitle')}</h2>
        {messages.length === 0 ? (
          <p className="system-msg">{t('admin.noMessages')}</p>
        ) : (
          <ol className="feed admin-inbox__list">
            {messages.map((item) => (
              <li className="post" key={item.id}>
                <Avatar name={item.name} />
                <div className="post__body">
                  <p className="post__meta">
                    <strong>{item.name}</strong>
                    <span className="admin-inbox__email">{item.email}</span>
                    {item.created_at && (
                      <>
                        <span aria-hidden="true">·</span>
                        <time dateTime={item.created_at}>{formatDateTime(item.created_at, lang)}</time>
                      </>
                    )}
                  </p>
                  <p className="bubble admin-inbox__bubble">{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

export function Admin() {
  const { t } = useI18n();
  const [token, setToken] = useState(readToken);
  const [tab, setTab] = useState('queue');
  const [defaultPassword, setDefaultPassword] = useState(false);

  const signOut = useCallback(() => {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
    setToken('');
  }, []);

  useEffect(() => {
    if (!token) return;
    api.admin
      .settings(token)
      .then((data) => setDefaultPassword(data.default_password))
      .catch((error) => error.status === 401 && signOut());
  }, [token, signOut]);

  if (!token) return <LoginForm onSuccess={setToken} />;

  return (
    <div className="admin">
      <div className="admin__top">
        <div className="shell">
          <div className="admin__head">
            <h1>{t('admin.loginTitle')}</h1>
            <button type="button" className="btn" onClick={signOut}>
              {t('admin.logout')}
            </button>
          </div>

          {defaultPassword && (
            <p className="notice notice--wait admin__warning">{t('admin.defaultPasswordWarning')}</p>
          )}

          <div className="threads admin__tabs" role="tablist" aria-label={t('admin.loginTitle')}>
            {[
              ['queue', 'admin.tabQueue'],
              ['all', 'admin.tabAll'],
              ['settings', 'admin.tabSettings'],
            ].map(([key, label]) => (
              <button
                key={key}
                id={`admin-tab-${key}`}
                type="button"
                role="tab"
                className="thread-tab"
                aria-selected={tab === key}
                aria-controls="admin-panel"
                onClick={() => setTab(key)}
              >
                {t(label)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="admin__thread">
        <div className="shell" id="admin-panel" role="tabpanel" aria-labelledby={`admin-tab-${tab}`}>
          {tab === 'queue' && <Queue token={token} onAuthError={signOut} />}
          {tab === 'all' && <AllListings token={token} onAuthError={signOut} />}
          {tab === 'settings' && <Settings token={token} onAuthError={signOut} />}
        </div>
      </div>
    </div>
  );
}
