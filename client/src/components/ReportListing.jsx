import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { api } from '../lib/api.js';

const REASONS = ['prohibited', 'scam', 'wrong_info', 'offensive', 'other'];

/** "Report this listing" link and its dialog. Works without signing in. */
export function ReportListing({ listingId }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | sent | error

  const close = () => {
    setOpen(false);
    if (state === 'sent') { setReason(''); setDetails(''); setState('idle'); }
  };
  const needsDetails = reason === 'other' && details.trim().length < 5;

  async function submit(event) {
    event.preventDefault();
    setState('sending');
    try {
      await api.reportListing(listingId, { reason, details: details.trim() });
      setState('sent');
    } catch {
      setState('error');
    }
  }

  return (
    <>
      <button type="button" className="report-link" onClick={() => setOpen(true)}>
        {t('listing.report')}
      </button>

      {open && (
        <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="report-title">
            <h3 id="report-title" style={{ marginBottom: 6 }}>{t('listing.reportTitle')}</h3>

            {state === 'sent' ? (
              <>
                <p style={{ margin: '12px 0 0' }}>{t('listing.reportThanks')}</p>
                <div className="row" style={{ justifyContent: 'flex-end', marginTop: 24 }}>
                  <button type="button" className="btn" onClick={close}>{t('common.close')}</button>
                </div>
              </>
            ) : (
              <form onSubmit={submit}>
                <p className="small muted" style={{ marginBottom: 18 }}>{t('listing.reportLead')}</p>
                <div className="report-reasons" role="radiogroup" aria-labelledby="report-title">
                  {REASONS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={reason === key}
                      className="report-reason"
                      onClick={() => setReason(key)}
                    >
                      {t(`listing.reportReasons.${key}`)}
                    </button>
                  ))}
                </div>
                <textarea
                  className="input"
                  rows={3}
                  maxLength={1000}
                  value={details}
                  aria-label={t('listing.reportDetails')}
                  placeholder={reason === 'other' ? t('listing.reportDetailsRequired') : t('listing.reportDetails')}
                  onChange={(event) => setDetails(event.target.value)}
                  style={{ marginTop: 14 }}
                />
                {state === 'error' && <p role="alert" className="field__error">{t('listing.reportError')}</p>}
                <div className="report-actions">
                  <Link to="/rules" target="_blank" className="small">{t('listing.reportRules')}</Link>
                  <div className="row">
                    <button type="button" className="btn btn--ghost" onClick={close}>{t('common.cancel')}</button>
                    <button type="submit" className="btn btn--danger" disabled={!reason || needsDetails || state === 'sending'}>
                      {state === 'sending' ? t('listing.reportSending') : t('listing.reportSubmit')}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
