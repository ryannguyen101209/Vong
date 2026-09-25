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

function CopyButton({ value, label }) {
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
    <button type="button" className="copy-btn pay-copy" data-copied={copied || undefined} onClick={copy}>
      {copied ? (
        <><CheckIcon size={16} /> {t('common.copied')}</>
      ) : (
        <>{t('common.copy')}<span className="sr-only"> {label}</span></>
      )}
    </button>
  );
}

/** One transfer detail: the label, then the value large enough to read off a phone. */
function Detail({ label, value, copyable = false, large = false }) {
  return (
    <div className={`pay-detail${large ? ' pay-detail--large' : ''}`}>
      <dt>{label}</dt>
      <dd>
        <span className={`pay-detail__value${copyable ? ' pay-detail__value--copy' : ''}`}>{value}</span>
        {copyable && <CopyButton value={String(value)} label={label} />}
      </dd>
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
      color: { dark: '#15202B', light: '#FFFFFF' },
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

  if (authLoading) return <div className="shell page"><p className="system-msg" role="status">{t('common.loading')}</p></div>;
  if (!profile) {
    return (
      <div className="shell gate">
        <h1>{t('auth.title')}</h1>
        <p>{t('auth.lead')}</p>
        <button type="button" className="btn btn--primary" onClick={openSignIn}>{t('auth.signIn')}</button>
      </div>
    );
  }
  if (status === 'loading') {
    return <div className="shell page"><p className="system-msg" role="status">{t('common.loading')}</p></div>;
  }
  if (status === 'unconfigured') {
    return (
      <div className="shell pay-status">
        <h1>{t('payment.title')}</h1>
        <p className="notice notice--wait">{t('payment.notSetUp')}</p>
      </div>
    );
  }
  if (status !== 'ready') {
    return <div className="shell page"><ErrorState onRetry={load} /></div>;
  }

  const { listing, payment } = data;
  const title = localized(listing, 'title');

  if (listing.status === 'awaiting_approval') {
    return (
      <div className="shell pay-status">
        <h1>{t('payment.checkingTitle')}</h1>
        <p className="status status--wait">{t('payment.statusAwaitingTitle')}</p>
        <p className="pay-status__body">{t('payment.checkingBody', { email: listing.seller_email })}</p>
        <p className="pay-status__ref">{t('payment.refNote', { ref: listing.ref })}</p>
        <div className="row pay-status__actions">
          <Link to="/my-listings" className="btn btn--primary">{t('mine.title')}</Link>
          <Link to="/browse" className="btn">{t('nav.browse')}</Link>
        </div>
      </div>
    );
  }

  if (listing.status === 'approved') {
    return (
      <div className="shell pay-status">
        <h1>{title}</h1>
        <p className="status status--ok">{t('payment.approvedTitle')}</p>
        <p className="pay-status__body">{t('payment.statusApprovedBody')}</p>
        <div className="pay-status__key">
          <PublishKeyForm listing={listing} keyInfo={data.key} onPublished={load} />
        </div>
      </div>
    );
  }

  if (listing.status === 'published') {
    return (
      <div className="shell pay-status">
        <h1>{title}</h1>
        <p className="status status--ok">{t('payment.statusPublishedTitle')}</p>
        <p className="pay-status__body">{t('payment.statusPublishedBody')}</p>
        <div className="row pay-status__actions">
          <Link to={`/listing/${listing.id}`} className="btn btn--primary">{t('payment.viewListing')}</Link>
          <Link to="/my-listings" className="btn">{t('mine.title')}</Link>
        </div>
      </div>
    );
  }

  const rejected = listing.status === 'rejected';

  return (
    <div className="pay">
      <div className="pay__top">
        <div className="shell pay__col">
          <h1>{t('payment.title')}</h1>
          <p className={`status ${rejected ? 'status--bad' : 'status--wait'}`}>
            {rejected ? t('payment.statusRejectedTitle') : t('payment.statusPendingTitle')}
          </p>
          <p className="pay__lead">{t('payment.lead')}</p>
          {rejected && (
            <div className="notice notice--bad pay__rejected">
              {listing.reject_reason && <p className="notice__title">{t('payment.statusRejectedBody', { reason: listing.reject_reason })}</p>}
              <p>{t('payment.statusRejectedRetry')}</p>
            </div>
          )}
        </div>
      </div>

      <div className="pay__thread">
        <div className="shell pay__col pay__grid">
          <figure className="pay-qr">
            <div className="pay-qr__tile">
              <div className="pay-qr__code">
                {qrImage ? (
                  <img src={qrImage} alt={t('payment.qrAlt')} width="512" height="512" />
                ) : (
                  <p className="muted small" role="status">{t('common.loading')}</p>
                )}
              </div>
              <p className="pay-qr__brand">
                <LogoMark size={20} />
                <span>VietQR · {payment.bank_name}</span>
              </p>
            </div>
            <figcaption className="pay-qr__steps">{t('payment.qrSteps')}</figcaption>
          </figure>

          <div className="pay__side">
            <section className="pay-details" aria-labelledby="pay-details-title">
              <h2 id="pay-details-title">{t('payment.manualTitle')}</h2>
              {/* Same order a banking app asks for them: bank, account, name, amount, note. */}
              <dl>
                <Detail label={t('payment.bank')} value={payment.bank_name} />
                <Detail label={t('payment.accountNumber')} value={payment.account_number} copyable large />
                <Detail label={t('payment.accountHolder')} value={payment.account_holder} />
                <Detail label={t('payment.amount')} value={formatPrice(payment.amount_vnd, lang)} large />
                <Detail label={t('payment.reference')} value={payment.reference} copyable large />
              </dl>
              <p className="pay-details__hint">{t('payment.noteHint')}</p>
            </section>

            <button type="button" className="btn btn--primary pay__mark" onClick={markPaid} disabled={marking}>
              {marking ? t('payment.marking') : t('payment.markPaid')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
