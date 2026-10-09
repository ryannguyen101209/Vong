import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { api } from '../lib/api.js';
import { formatPrice, formatDateTime, digitsOnly } from '../lib/format.js';
import { Field } from '../components/Field.jsx';
import { EmptyState } from '../components/States.jsx';
import { ListingImage } from '../components/ListingCard.jsx';

// sessionStorage, not localStorage: closing the tab should end the admin session.
const TOKEN_KEY = 'vong.admin.token';

function readToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
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
    <div className="shell section editorial-page admin-page admin-page--login">
      <div className="card panel admin-login">
        <h1 style={{ fontSize: '1.7rem' }}>{t('admin.loginTitle')}</h1>
        <p className="muted small" style={{ marginBottom: 24 }}>{t('admin.loginLead')}</p>

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
          <button type="submit" className="btn btn--accent btn--block" disabled={busy || !password}>
            {busy ? t('admin.loggingIn') : t('admin.login')}
          </button>
        </form>
      </div>
    </div>
  );
}

function RejectDialog({ onClose, onSubmit }) {
  const { t } = useI18n();
  const [reason, setReason] = useState('');
  const presets = [
    'rejectPresetNoPayment',
    'rejectPresetWrongAmount',
    'rejectPresetProhibited',
    'rejectPresetQuality',
  ];

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true">
        <h3 style={{ marginBottom: 6 }}>{t('admin.rejectTitle')}</h3>
        <p className="small muted" style={{ marginBottom: 20 }}>{t('admin.rejectLead')}</p>

        <div className="chip-row" style={{ marginBottom: 16 }}>
          {presets.map((key) => (
            <button key={key} type="button" className="chip" onClick={() => setReason(t(`admin.${key}`))}>
              {t(`admin.${key}`)}
            </button>
          ))}
        </div>

        <textarea
          className="input"
          rows={3}
          value={reason}
          maxLength={500}
          placeholder={t('admin.rejectPlaceholder')}
          onChange={(event) => setReason(event.target.value)}
        />

        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
          <button type="button" className="btn btn--ghost" onClick={onClose}>{t('common.cancel')}</button>
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
 * Builds a mailto: link with the approval or rejection message filled in.
 * The app sends nothing itself -- this opens a draft in the admin's own mail
 * app, which is the honest way to do it until a mail service is wired up.
 */
function sellerMailto({ listing, action, reason, title, t }) {
  const key = action === 'approve' ? 'Approved' : 'Rejected';
  const vars = {
    name: listing.seller_name,
    title,
    ref: listing.ref,
    reason: reason || listing.reject_reason || '—',
    url: `${window.location.origin}/listing/${listing.id}`,
  };
  const subject = t(`admin.email${key}Subject`, vars);
  const body = t(`admin.email${key}Body`, vars);
  return `mailto:${encodeURIComponent(listing.seller_email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function Queue({ token, onAuthError }) {
  const { t, lang, localized } = useI18n();
  const [listings, setListings] = useState([]);
  const [counts, setCounts] = useState({});
  const [freeGiven, setFreeGiven] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  // What you just did, so the seller can be emailed at the moment it happens.
  const [lastAction, setLastAction] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.admin
      .listings(token, 'queue')
      .then((data) => {
        setListings(data.listings);
        setCounts(data.counts);
        setFreeGiven(data.free_given ?? 0);
      })
      .catch((error) => error.status === 401 && onAuthError())
      .finally(() => setLoading(false));
  }, [token, onAuthError]);

  useEffect(load, [load]);

  const act = async (id, action, reason) => {
    const listing = listings.find((item) => item.id === id);
    setBusyId(id);
    try {
      if (action === 'approve') await api.admin.approve(token, id);
      else await api.admin.reject(token, id, reason);
      setRejecting(null);
      setLastAction({ listing, action, reason });
      load();
    } catch (error) {
      if (error.status === 401) onAuthError();
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <p className="muted">{t('common.loading')}</p>;

  return (
    <>
      <p className="lead" style={{ marginBottom: 24 }}>{t('admin.queueLead')}</p>

      <div className="row" style={{ marginBottom: 24, gap: 8 }}>
        {['awaiting_approval', 'published', 'pending_payment', 'rejected'].map((key) => (
          <span className="badge" key={key}>
            {t(`status.${key}`)}: {counts[key] ?? 0}
          </span>
        ))}
        <span className="badge">{t('admin.freeGiven', { n: freeGiven })}</span>
      </div>

      {lastAction && (
        <div
          className={`notice notice--${lastAction.action === 'approve' ? 'positive' : 'danger'}`}
          style={{ marginBottom: 20 }}
        >
          <p className="notice__title">
            {t(lastAction.action === 'approve' ? 'admin.actionedApproved' : 'admin.actionedRejected', {
              title: localized(lastAction.listing, 'title'),
            })}
          </p>
          {lastAction.listing.seller_email ? (
            <>
              <p className="small" style={{ margin: '0 0 12px' }}>{t('admin.actionedHint')}</p>
              <a
                className="btn btn--small"
                href={sellerMailto({
                  listing: lastAction.listing,
                  action: lastAction.action,
                  reason: lastAction.reason,
                  title: localized(lastAction.listing, 'title'),
                  t,
                })}
              >
                {t('admin.emailSeller')} →
              </a>
            </>
          ) : (
            <p className="small" style={{ margin: 0 }}>{t('admin.noSellerEmail')}</p>
          )}
        </div>
      )}

      {listings.length === 0 ? (
        <EmptyState title={t('admin.queueEmptyTitle')} body={t('admin.queueEmptyBody')} />
      ) : (
        <div className="stack" style={{ gap: 16 }}>
          {listings.map((listing) => (
            <article className="card queue-item" key={listing.id}>
              <div className="queue-item__media">
                <ListingImage listing={listing} alt="" />
              </div>

              <div>
                <h3 style={{ marginBottom: 6, fontSize: '1.1rem' }}>{localized(listing, 'title')}</h3>
                <div className="row" style={{ gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                  {listing.is_first_listing && <span className="badge badge--positive">{t('admin.firstListing')}</span>}
                  {listing.payment_verified_at && <span className="badge badge--positive">{t('admin.paymentVerified')}</span>}
                  {listing.status === 'pending_payment' && <span className="badge">{t('status.pending_payment')}</span>}
                  <SellerCount listing={listing} />
                </div>
                <p className="small muted" style={{ marginBottom: 10 }}>
                  {listing.seller_name} · {listing.seller_phone} · {t(`districts.${listing.district}`)} ·{' '}
                  {formatPrice(listing.price_vnd, lang)}
                  {listing.seller_email && (
                    <>
                      <br />
                      <a href={`mailto:${listing.seller_email}`}>{listing.seller_email}</a>
                    </>
                  )}
                </p>

                <div className="notice notice--warning small">
                  {listing.fee_vnd === 0 ? (
                    <div>{t('admin.freeFirstListing')}</div>
                  ) : listing.status === 'pending_payment' ? (
                    <>
                      <div>
                        {t('admin.expectedAmount', { amount: formatPrice(listing.fee_vnd, lang), ref: listing.ref })}
                      </div>
                      <div className="muted">{t('admin.notMarkedPaid')}</div>
                    </>
                  ) : (
                    <>
                      <div>
                        {t('admin.expectedAmount', {
                          amount: formatPrice(listing.fee_vnd, lang),
                          ref: listing.ref,
                        })}
                      </div>
                      <div className="muted">
                        {t('admin.sellerClaims', { when: formatDateTime(listing.paid_marked_at, lang) })}
                      </div>
                    </>
                  )}
                </div>

                <div className="queue-item__actions">
                  <button
                    type="button"
                    className="btn btn--small"
                    disabled={busyId === listing.id}
                    onClick={() => act(listing.id, 'approve')}
                  >
                    {busyId === listing.id ? t('admin.approving') : t('admin.approve')}
                  </button>
                  <button
                    type="button"
                    className="btn btn--danger btn--small"
                    disabled={busyId === listing.id}
                    onClick={() => setRejecting(listing.id)}
                  >
                    {t('admin.reject')}
                  </button>
                  <DeleteButton token={token} id={listing.id} onDeleted={load} onAuthError={onAuthError} />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {rejecting && (
        <RejectDialog
          onClose={() => setRejecting(null)}
          onSubmit={(reason) => act(rejecting, 'reject', reason)}
        />
      )}
    </>
  );
}

/** Takes a listing down. The first click asks, the second deletes. */
function DeleteButton({ token, id, onDeleted, onAuthError }) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      await api.admin.remove(token, id);
      onDeleted();
    } catch (error) {
      if (error.status === 401) onAuthError();
      setBusy(false);
      setConfirming(false);
    }
  };

  if (!confirming) {
    return (
      <button type="button" className="btn btn--ghost btn--small" onClick={() => setConfirming(true)}>
        {t('admin.delete')}
      </button>
    );
  }
  return (
    <span className="row" style={{ gap: 6 }}>
      <button type="button" className="btn btn--danger btn--small" disabled={busy} onClick={remove}>
        {t('admin.confirmDelete')}
      </button>
      <button type="button" className="btn btn--ghost btn--small" disabled={busy} onClick={() => setConfirming(false)}>
        {t('common.cancel')}
      </button>
    </span>
  );
}

/** "Listing #3 of 7 from this seller", or nothing for listings with no account. */
function SellerCount({ listing }) {
  const { t } = useI18n();
  if (!listing.seller_index) return null;
  return <span className="badge">{t('admin.sellerTotal', { index: listing.seller_index, n: listing.seller_total })}</span>;
}

function AllListings({ token, onAuthError }) {
  const { t, lang, localized } = useI18n();
  const [status, setStatus] = useState('published');
  const [listings, setListings] = useState([]);

  const load = useCallback(() => {
    api.admin
      .listings(token, status)
      .then((data) => setListings(data.listings))
      .catch((error) => error.status === 401 && onAuthError());
  }, [token, status, onAuthError]);

  useEffect(load, [load]);

  return (
    <>
      <div className="row" style={{ marginBottom: 20 }}>
        <span className="small muted">{t('admin.statusFilter')}</span>
        <select className="select" value={status} onChange={(event) => setStatus(event.target.value)}>
          {['published', 'awaiting_approval', 'pending_payment', 'rejected'].map((key) => (
            <option key={key} value={key}>{t(`status.${key}`)}</option>
          ))}
        </select>
      </div>

      <div className="card panel table-scroll">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t('sell.titleLabel')}</th>
              <th>{t('admin.sellerColumn')}</th>
              <th>{t('listing.reference')}</th>
              <th>{t('sell.priceLabel')}</th>
              <th>{t('listing.district')}</th>
              <th>{t('listing.views')}</th>
              <th>{t('listing.posted')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {listings.map((listing) => (
              <tr key={listing.id}>
                <td>
                  <a href={`/listing/${listing.id}`}>{localized(listing, 'title')}</a>
                  {listing.reject_reason && (
                    <div className="small muted">{listing.reject_reason}</div>
                  )}
                </td>
                <td>
                  <div>{listing.seller_name}</div>
                  <div className="row" style={{ gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    {listing.is_first_listing && <span className="badge badge--positive">{t('admin.firstListing')}</span>}
                    <SellerCount listing={listing} />
                  </div>
                </td>
                <td style={{ fontFamily: 'ui-monospace, monospace' }}>{listing.ref}</td>
                <td>{formatPrice(listing.price_vnd, lang)}</td>
                <td>{t(`districts.${listing.district}`)}</td>
                <td>{listing.views}</td>
                <td>{formatDateTime(listing.created_at, lang)}</td>
                <td><DeleteButton token={token} id={listing.id} onDeleted={load} onAuthError={onAuthError} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {listings.length === 0 && <p className="muted small" style={{ marginTop: 16 }}>{t('admin.queueEmptyBody')}</p>}
      </div>
    </>
  );
}

/** Listings people reported: take the listing down, or dismiss the report. */
function Reports({ token, onAuthError, onCount }) {
  const { t, lang, localized } = useI18n();
  const [reports, setReports] = useState(null);

  const load = useCallback(() => {
    api.admin
      .reports(token)
      .then((data) => { setReports(data.reports); onCount(data.reports.length); })
      .catch((error) => error.status === 401 && onAuthError());
  }, [token, onAuthError, onCount]);

  useEffect(load, [load]);

  const dismiss = (id) =>
    api.admin.dismissReport(token, id).then(load).catch((error) => error.status === 401 && onAuthError());

  if (!reports) return <p className="muted">{t('common.loading')}</p>;

  return (
    <>
      <p className="muted" style={{ marginBottom: 20, maxWidth: '62ch' }}>{t('admin.reportsLead')}</p>
      {reports.length === 0 ? (
        <div className="card panel"><p className="muted small" style={{ margin: 0 }}>{t('admin.noReports')}</p></div>
      ) : (
        <div className="stack" style={{ gap: 14 }}>
          {reports.map((report) => (
            <div key={report.id} className="card panel admin-report">
              <div className="spread" style={{ alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <p className="notice__title" style={{ marginBottom: 4 }}>
                    <a href={`/listing/${report.listing_id}`} target="_blank" rel="noopener">{localized(report, 'title')}</a>
                  </p>
                  <p className="small muted" style={{ margin: 0 }}>
                    {report.seller_name} · <span style={{ fontFamily: 'ui-monospace, monospace' }}>{report.ref}</span> · {formatDateTime(report.created_at, lang)}
                  </p>
                </div>
                <span className="badge badge--danger">{t(`listing.reportReasons.${report.reason}`)}</span>
              </div>
              {report.details && <p className="admin-report__details">{report.details}</p>}
              <div className="row" style={{ gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <DeleteButton token={token} id={report.listing_id} onDeleted={load} onAuthError={onAuthError} />
                <button type="button" className="btn btn--ghost btn--small" onClick={() => dismiss(report.id)}>
                  {t('admin.reportDismiss')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Settings({ token, onAuthError }) {
  const { t } = useI18n();
  const [banks, setBanks] = useState([]);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [messages, setMessages] = useState([]);
  const [backup, setBackup] = useState(null);

  useEffect(() => {
    api.admin
      .settings(token)
      .then((data) => {
        setBanks(data.banks);
        setForm(data.settings);
        setBackup(data.backup ?? null);
      })
      .catch((error) => error.status === 401 && onAuthError());
    api.admin.messages(token).then((data) => setMessages(data.messages)).catch(() => {});
  }, [token, onAuthError]);

  if (!form) return <p className="muted">{t('common.loading')}</p>;

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
    <>
      <p className="lead" style={{ marginBottom: 24 }}>{t('admin.settingsLead')}</p>

      <form className="card panel form" onSubmit={save} style={{ maxWidth: 620 }}>
        <Field label={t('admin.bankLabel')}>
          {(props) => (
            <select {...props} value={form.bank_bin} onChange={set('bank_bin')}>
              {banks.map((bank) => (
                <option key={bank.bin} value={bank.bin}>{bank.name} ({bank.bin})</option>
              ))}
            </select>
          )}
        </Field>

        <Field label={t('admin.accountNumberLabel')}>
          {(props) => (
            <input {...props} className="input" value={form.account_number} onChange={set('account_number')} />
          )}
        </Field>

        <Field label={t('admin.accountHolderLabel')} hint={t('admin.accountHolderHint')}>
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

        <Field label={t('admin.feeLabel')} hint={t('admin.feeHint')}>
          {(props) => (
            <input
              {...props}
              className="input"
              inputMode="numeric"
              value={form.fee_vnd}
              onChange={(event) =>
                setForm((current) => ({ ...current, fee_vnd: digitsOnly(event.target.value) }))
              }
            />
          )}
        </Field>

        {message && (
          <div className={`notice notice--${message === 'saved' ? 'positive' : 'danger'}`}>
            {message === 'saved' ? t('admin.settingsSaved') : t('admin.settingsError')}
          </div>
        )}

        <button type="submit" className="btn btn--accent" disabled={saving}>
          {saving ? t('admin.savingSettings') : t('admin.saveSettings')}
        </button>
      </form>

      <div className="card panel" style={{ marginTop: 28, maxWidth: 620 }}>
        <p className="eyebrow">{t('admin.previewTitle')}</p>
        <p className="small muted">{t('admin.previewBody')}</p>
      </div>

      <BackupPanel token={token} backup={backup} onBackup={setBackup} onAuthError={onAuthError} />

      <div className="card panel" style={{ marginTop: 28 }}>
        <h3 style={{ fontSize: '1.1rem' }}>{t('admin.messagesTitle')}</h3>
        {messages.length === 0 ? (
          <p className="small muted" style={{ margin: 0 }}>{t('admin.noMessages')}</p>
        ) : (
          <div className="stack" style={{ gap: 14 }}>
            {messages.map((item) => (
              <div key={item.id} className="notice">
                <p className="notice__title">{item.name} · {item.email}</p>
                <p className="small" style={{ margin: 0 }}>{item.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/** Download the database, and see / test the daily backup email. */
function BackupPanel({ token, backup, onBackup, onAuthError }) {
  const { t, lang } = useI18n();
  const [busy, setBusy] = useState(null);
  const [result, setResult] = useState(null);

  const run = async (kind) => {
    setBusy(kind);
    setResult(null);
    try {
      if (kind === 'download') {
        await api.admin.downloadBackup(token);
      } else {
        const data = await api.admin.emailBackup(token);
        onBackup({ ...backup, last_sent: data.last_sent });
        setResult('emailed');
      }
    } catch (error) {
      if (error.status === 401) onAuthError();
      setResult(kind === 'download' ? 'downloadFailed' : 'emailFailed');
    } finally {
      setBusy(null);
    }
  };

  const emailOn = Boolean(backup?.email && backup?.mail_enabled);
  return (
    <div className="card panel" style={{ marginTop: 28, maxWidth: 620 }}>
      <h3 style={{ fontSize: '1.1rem' }}>{t('admin.backupTitle')}</h3>
      <p className="small muted">{t('admin.backupBody')}</p>
      <p className="small" style={{ marginBottom: 16 }}>
        {emailOn
          ? t('admin.backupEmailOn', {
              email: backup.email,
              last: backup.last_sent ? formatDateTime(backup.last_sent.created_at, lang) : t('admin.backupNever'),
            })
          : t('admin.backupEmailOff')}
      </p>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn--small" disabled={busy !== null} onClick={() => run('download')}>
          {busy === 'download' ? t('admin.backupPreparing') : t('admin.backupDownload')}
        </button>
        {emailOn && (
          <button type="button" className="btn btn--ghost btn--small" disabled={busy !== null} onClick={() => run('email')}>
            {busy === 'email' ? t('admin.backupSending') : t('admin.backupEmailNow')}
          </button>
        )}
      </div>
      {result && <p className="small" role="status" style={{ marginTop: 12, marginBottom: 0 }}>{t(`admin.backup_${result}`)}</p>}
    </div>
  );
}

export function Admin() {
  const { t } = useI18n();
  const [token, setToken] = useState(readToken);
  const [tab, setTab] = useState('queue');
  const [openReports, setOpenReports] = useState(0);
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
    api.admin.reports(token).then((data) => setOpenReports(data.reports.length)).catch(() => {});
  }, [token, signOut]);

  if (!token) return <LoginForm onSuccess={setToken} />;

  return (
    <div className="shell section editorial-page admin-page">
      <div className="spread" style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0 }}>{t('admin.loginTitle')}</h1>
        <button type="button" className="btn btn--ghost btn--small" onClick={signOut}>
          {t('admin.logout')}
        </button>
      </div>

      {defaultPassword && (
        <div className="notice notice--warning" style={{ marginBottom: 24 }}>
          {t('admin.defaultPasswordWarning')}
        </div>
      )}

      <div className="tabs" role="tablist" style={{ marginBottom: 28 }}>
        {[
          ['queue', 'admin.tabQueue'],
          ['all', 'admin.tabAll'],
          ['reports', 'admin.tabReports'],
          ['settings', 'admin.tabSettings'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            className="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
          >
            {t(label)}
            {key === 'reports' && openReports > 0 && <span className="tab__count">{openReports}</span>}
          </button>
        ))}
      </div>

      {tab === 'queue' && <Queue token={token} onAuthError={signOut} />}
      {tab === 'all' && <AllListings token={token} onAuthError={signOut} />}
      {tab === 'reports' && <Reports token={token} onAuthError={signOut} onCount={setOpenReports} />}
      {tab === 'settings' && <Settings token={token} onAuthError={signOut} />}
    </div>
  );
}
