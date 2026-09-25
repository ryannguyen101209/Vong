import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { api } from '../lib/api.js';
import { KeyIcon } from './Icons.jsx';

/** Uppercase, only the key alphabet, and a dash after the first four. */
function formatKey(value) {
  const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

/**
 * The key area: where a seller types the one-time key we emailed them after
 * their listing was approved. Entering it is what puts the listing live.
 */
export function PublishKeyForm({ listing, keyInfo, onPublished, compact = false }) {
  const { t } = useI18n();
  const inputId = useId();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [resend, setResend] = useState(null);
  const blocked = keyInfo?.locked || keyInfo?.expired;

  const submit = async (event) => {
    event.preventDefault();
    if (value.replace('-', '').length !== 8 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.publish(listing.id, value);
      onPublished?.();
    } catch (failure) {
      setError({ code: failure.payload?.error || 'error', left: failure.payload?.attempts_left });
      setBusy(false);
    }
  };

  const sendNewKey = async () => {
    setResend('sending');
    try {
      await api.resendKey(listing.id);
      setResend('sent');
      setError(null);
      setValue('');
    } catch (failure) {
      setResend(failure.payload?.error === 'resend_too_soon' ? 'too_soon' : 'failed');
    }
  };

  const errorText = () => {
    if (!error) return null;
    if (error.code === 'wrong_key') return t('key.errorWrong', { count: error.left });
    if (error.code === 'key_locked') return t('key.errorLocked');
    if (error.code === 'key_expired') return t('key.errorExpired');
    if (error.code === 'too_many_attempts') return t('key.errorTooMany');
    return t('common.error');
  };
  const needsNewKey = resend !== 'sent' && (blocked || ['key_locked', 'key_expired'].includes(error?.code));

  return (
    <section className={`key-area${compact ? ' key-area--compact' : ''}`} aria-labelledby={`${inputId}-title`}>
      <div className="key-area__head">
        <span className="key-area__icon" aria-hidden="true"><KeyIcon /></span>
        <div>
          <h2 id={`${inputId}-title`} className="key-area__title">{t('key.title')}</h2>
          <p className="key-area__lead">
            {resend === 'sent'
              ? t('key.resent', { email: keyInfo?.sent_to })
              : t('key.lead', { email: keyInfo?.sent_to })}
          </p>
        </div>
      </div>

      <form className="key-area__form" onSubmit={submit} noValidate>
        <label className="sr-only" htmlFor={inputId}>{t('key.label')}</label>
        <input
          id={inputId}
          className="key-input"
          value={value}
          onChange={(event) => { setValue(formatKey(event.target.value)); setError(null); }}
          placeholder="XXXX-XXXX"
          inputMode="text"
          autoComplete="one-time-code"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={9}
          disabled={busy || needsNewKey}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
        />
        <button type="submit" className="btn btn--accent" disabled={busy || needsNewKey || value.replace('-', '').length !== 8}>
          {busy ? t('key.publishing') : t('key.submit')}
        </button>
      </form>

      {error && <p className="field__error" id={`${inputId}-error`} role="alert">{errorText()}</p>}
      {!error && needsNewKey && <p className="field__error" role="status">{keyInfo?.locked ? t('key.errorLocked') : t('key.errorExpired')}</p>}

      <div className="key-area__help">
        {keyInfo?.can_resend ? (
          <>
            <span>{t('key.help')}</span>
            <button type="button" className="link-quiet" onClick={sendNewKey} disabled={resend === 'sending'}>
              {resend === 'sending' ? t('key.resending') : t('key.resend')}
            </button>
            {resend === 'too_soon' && <span className="key-area__status" role="status">{t('key.resendTooSoon')}</span>}
            {resend === 'failed' && <span className="key-area__status" role="status">{t('key.resendFailed')}</span>}
          </>
        ) : (
          <span>
            {t('key.helpManual', { ref: listing.ref })} <Link to="/contact">{t('nav.contact')}</Link>
          </span>
        )}
      </div>
    </section>
  );
}
