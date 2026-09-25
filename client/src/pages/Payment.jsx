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
import { PublishKeyForm } from '../components/PublishKeyForm.jsx';

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
  const [qrImage, setQrImage] = useState(null);
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

  // Render the EMVCo string the server built into an actual scannable code.
  useEffect(() => {
    if (!data?.payment?.qr_payload) return;
    QRCode.toDataURL(data.payment.qr_payload, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 512,
      color: { dark: '#0A2947', light: '#FFFFFF' },
    })
      .then(setQrImage)
      .catch(() => setQrImage(null));
  }, [data]);

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
  if (!profile) return <div className="shell section messages-gate"><h1>{t('auth.title')}</h1><p className="lead">{t('auth.lead')}</p><button className="btn btn--primary" onClick={openSignIn}>{t('auth.signIn')}</button></div>;
  if (status === 'loading') {
    return <div className="shell section editorial-page payment-page"><p className="muted">{t('common.loading')}</p></div>;
  }
  if (status === 'unconfigured') {
    return (
      <div className="shell section editorial-page payment-page">
        <div className="notice notice--wait">{t('payment.notConfigured')}</div>
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
          <h1>{t('payment.markedTitle')}</h1>
          <p className="lead">{t('payment.markedBody', { email: listing.seller_email })}</p>
          <p className="small muted" style={{ marginTop: 16 }}>
            {t('payment.markedRef', { ref: listing.ref })}
          </p>
          <div className="row" style={{ marginTop: 24 }}>
            <Link to="/my-listings" className="btn btn--primary">{t('mine.title')}</Link>
            <Link to="/browse" className="btn">{t('nav.browse')}</Link>
          </div>
        </div>
      </div>
    );
  }

  if (listing.status === 'approved') {
    return (
      <div className="shell section editorial-page payment-page payment-page--status">
        <div className="card panel">
          <p className="eyebrow row" style={{ gap: 6 }}><CheckIcon /> {t('payment.statusApprovedTitle')}</p>
          <h1>{title}</h1>
          <p className="lead">{t('payment.statusApprovedBody')}</p>
          <PublishKeyForm listing={listing} keyInfo={data.key} onPublished={load} />
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
            <Link to={`/listing/${listing.id}`} className="btn btn--primary">{t('payment.viewListing')}</Link>
            <Link to="/my-listings" className="btn">{t('mine.title')}</Link>
          </div>
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
        <div className="notice notice--bad" style={{ marginBottom: 28 }}>
          <p className="notice__title">{t('payment.statusRejectedTitle')}</p>
          <p>{t('payment.statusRejectedBody', { reason: data.listing.reject_reason || '—' })}</p>
          <p className="small" style={{ margin: 0 }}>{t('payment.statusRejectedRetry')}</p>
        </div>
      )}

      <div className="payment-grid">
        <div className="qr-frame">
          {qrImage ? (
            <img src={qrImage} alt={t('payment.qrAlt')} />
          ) : (
            <p className="muted small">{t('common.loading')}</p>
          )}
          <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
            <span style={{ color: '#0A2947' }}><LogoMark size={22} /></span>
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
            <p className="notice__title">{t('payment.manualTitle')}</p>
            <p className="small" style={{ margin: 0 }}>{t('payment.manualBody')}</p>
          </div>

          <div>
            <button type="button" className="btn btn--primary btn--block" onClick={markPaid} disabled={marking}>
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
