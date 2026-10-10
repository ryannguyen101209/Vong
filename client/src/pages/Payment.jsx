import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { useI18n } from '../i18n/index.jsx';
import { api } from '../lib/api.js';
import { formatPrice } from '../lib/format.js';
import { ErrorState } from '../components/States.jsx';
import { LogoMark } from '../components/Logo.jsx';
import { CheckIcon } from '../components/Icons.jsx';
import { useAuth } from '../lib/auth.jsx';

/**
 * Draws this listing's VietQR from the payload the server built: account,
 * amount and the "SEVQR VONG-..." note, so the bank app fills all three in.
 * Plain square modules on white, which every banking app scans reliably.
 */
function PaymentQr({ payload, alt }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 2, width: 560, color: { dark: '#000000', light: '#ffffff' } })
      .then((url) => live && setSrc(url))
      .catch(() => live && setSrc(''));
    return () => { live = false; };
  }, [payload]);
  return src ? <img src={src} alt={alt} /> : <div className="qr-frame__placeholder" aria-hidden="true" />;
}

function CopyButton({ value }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* Clipboard needs https or permission; the value is on screen anyway. */
    }
  };

  return (
    <button type="button" className="copy-btn" onClick={copy}>
      {copied ? t('common.copied') : t('common.copy')}
    </button>
  );
}

function Row({ label, value, mono = false, copyable = false }) {
  return (
    <div className="detail-row">
      <span className="detail-row__label">{label}</span>
      <span className={`detail-row__value${mono ? ' detail-row__value--mono' : ''}`}>
        {value}
        {copyable && <CopyButton value={String(value)} />}
      </span>
    </div>
  );
}

export function Payment() {
  const { id } = useParams();
  const { t, lang, localized } = useI18n();
  const { profile, loading: authLoading, openSignIn } = useAuth();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [marking, setMarking] = useState(false);

  const load = useCallback(() => {
    if (!profile) return;
    setStatus('loading');
    api
      .payment(id)
      .then((payload) => {
        setData(payload);
        setStatus('ready');
      })
      .catch((error) => {
        if (error.payload?.error === 'payment_not_configured') setStatus('unconfigured');
        else setStatus(error.status === 404 ? 'missing' : 'error');
      });
  }, [id, profile]);

  useEffect(load, [load]);

  // The bank transfer is matched automatically on the server, so while we wait
  // for money, quietly re-check every few seconds and switch screens by itself.
  const waiting = status === 'ready' && data?.listing && !data.listing.free && ['pending_payment', 'rejected'].includes(data.listing.status);
  useEffect(() => {
    if (!waiting || !profile) return undefined;
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      api.payment(id).then((payload) => {
        if (payload.listing.status !== data.listing.status) setData(payload);
      }).catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [waiting, profile, id, data]);

  const markPaid = async () => {
    setMarking(true);
    try {
      await api.markPaid(id);
      load();
    } finally {
      setMarking(false);
    }
  };

  if (authLoading) return <div className="shell section"><p role="status">{t('common.loading')}</p></div>;
  if (!profile) return <div className="shell section messages-gate"><h1>{t('auth.title')}</h1><p className="lead">{t('auth.lead')}</p><button className="btn btn--accent" onClick={openSignIn}>{t('auth.signIn')}</button></div>;
  if (status === 'loading') {
    return <div className="shell section editorial-page payment-page"><p className="muted">{t('common.loading')}</p></div>;
  }
  if (status === 'unconfigured') {
    return (
      <div className="shell section editorial-page payment-page">
        <div className="notice notice--warning">{t('payment.notConfigured')}</div>
      </div>
    );
  }
  if (status !== 'ready') {
    return <div className="shell section editorial-page payment-page"><ErrorState onRetry={load} /></div>;
  }

  const { listing, payment } = data;
  const title = localized(listing, 'title');

  if (listing.status === 'awaiting_approval') {
    return (
      <div className="shell section editorial-page payment-page payment-page--status">
        <div className="card panel">
          <p className="eyebrow row" style={{ gap: 6 }}><CheckIcon /> {t('payment.statusAwaitingTitle')}</p>
          <h1>{listing.payment_verified ? t('payment.verifiedTitle') : t('payment.markedTitle')}</h1>
          <p className="lead">{listing.free ? t('payment.freeMarkedBody') : listing.payment_verified ? t('payment.verifiedBody') : t('payment.markedBody')}</p>
          <p className="small muted" style={{ marginTop: 16 }}>
            {t('payment.markedRef', { ref: listing.ref })}
          </p>
          <p className="small muted">{t('payment.saveLink')}</p>
          <div className="row" style={{ marginTop: 24 }}>
            <Link to="/" className="btn btn--ghost">{t('payment.backHome')}</Link>
            <Link to="/browse" className="btn btn--ghost">{t('nav.browse')}</Link>
          </div>
        </div>
      </div>
    );
  }

  if (listing.status === 'published') {
    return (
      <div className="shell section editorial-page payment-page payment-page--status">
        <div className="card panel">
          <p className="eyebrow">{t('payment.statusPublishedTitle')}</p>
          <h1>{title}</h1>
          <p className="lead">{t('payment.statusPublishedBody')}</p>
          <div className="row" style={{ marginTop: 24 }}>
            <Link to={`/listing/${listing.id}`} className="btn btn--accent">{t('payment.viewListing')}</Link>
            <Link to="/" className="btn btn--ghost">{t('payment.backHome')}</Link>
          </div>
        </div>
      </div>
    );
  }

  // A rejected free listing has no transfer to make: show why, and let them resubmit.
  if (listing.free) {
    return (
      <div className="shell section editorial-page payment-page payment-page--status">
        <div className="card panel">
          <p className="eyebrow">{t('payment.statusRejectedTitle')}</p>
          <p>{t('payment.statusRejectedBody', { reason: listing.reject_reason || '—' })}</p>
          <p className="small muted">{t('payment.statusRejectedRetry')}</p>
          <button type="button" className="btn btn--accent" onClick={markPaid} disabled={marking} style={{ marginTop: 16 }}>
            {marking ? t('payment.marking') : t('payment.freeResubmit')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="shell section editorial-page payment-page">
      <div className="section-head">
        <p className="eyebrow">
          {listing.status === 'rejected' ? t('payment.statusRejectedTitle') : t('payment.statusPendingTitle')}
        </p>
        <h1>{t('payment.title')}</h1>
        <p className="lead">{t('payment.lead')}</p>
      </div>

      {listing.status === 'rejected' && (
        <div className="notice notice--danger" style={{ marginBottom: 28 }}>
          <p className="notice__title">{t('payment.statusRejectedTitle')}</p>
          <p>{t('payment.statusRejectedBody', { reason: data.listing.reject_reason || '—' })}</p>
          <p className="small" style={{ margin: 0 }}>{t('payment.statusRejectedRetry')}</p>
        </div>
      )}

      <div className="payment-grid">
        <div className="qr-frame">
          <PaymentQr payload={payment.qr_payload} alt={t('payment.qrAlt')} />
          <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
            <span style={{ color: '#38604A' }}><LogoMark size={22} /></span>
            <span className="qr-frame__brand">VietQR · {payment.bank_name}</span>
          </div>
        </div>

        <div className="stack" style={{ gap: 24 }}>
          <div className="card panel">
            <div className="detail-rows">
              <Row label={t('payment.amount')} value={formatPrice(payment.amount_vnd, lang)} />
              <Row label={t('payment.reference')} value={payment.reference} mono copyable />
              <Row label={t('payment.bank')} value={payment.bank_name} />
              <Row label={t('payment.accountNumber')} value={payment.account_number} mono copyable />
              <Row label={t('payment.accountHolder')} value={payment.account_holder} />
            </div>
            <p className="small muted" style={{ marginTop: 16 }}>{t('payment.referenceHint')}</p>
          </div>

          <div className="notice">
            <p className="notice__title">{t('payment.autoTitle')}</p>
            <p className="small" style={{ margin: 0 }}>{t('payment.autoBody')}</p>
          </div>

          <div className="notice">
            <p className="notice__title">{t('payment.manualTitle')}</p>
            <p className="small" style={{ margin: 0 }}>{t('payment.manualBody')}</p>
          </div>

          <div>
            <button type="button" className="btn btn--accent btn--block" onClick={markPaid} disabled={marking}>
              {marking ? t('payment.marking') : t('payment.markPaid')}
            </button>
            <p className="small muted" style={{ marginTop: 12, textAlign: 'center' }}>
              {t('payment.qrHint')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
