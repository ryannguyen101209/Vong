import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { GOOGLE_CLIENT_ID, useAuth } from '../lib/auth.jsx';
import { CloseIcon } from './Icons.jsx';

const GOOGLE_SCRIPT = 'https://accounts.google.com/gsi/client';

function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GOOGLE_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google), { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = GOOGLE_SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export function SignInDialog() {
  const { t } = useI18n();
  const { signInOpen, closeSignIn, completeGoogleSignIn, googleConfigured } = useAuth();
  const buttonRef = useRef(null);
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    if (!signInOpen || !googleConfigured || !buttonRef.current) return undefined;
    let active = true;
    setStatus('loading');
    loadGoogleIdentity()
      .then((google) => {
        if (!active) return;
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: ({ credential }) => completeGoogleSignIn(credential),
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        buttonRef.current.replaceChildren();
        google.accounts.id.renderButton(buttonRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          width: Math.min(360, buttonRef.current.clientWidth),
        });
        setStatus('ready');
      })
      .catch(() => active && setStatus('error'));
    return () => {
      active = false;
    };
  }, [signInOpen, googleConfigured, completeGoogleSignIn]);

  if (!signInOpen) return null;

  return (
    <div className="dialog-backdrop auth-backdrop" role="presentation" onMouseDown={closeSignIn}>
      <section className="dialog auth-dialog" role="dialog" aria-modal="true" aria-labelledby="signin-title" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="dialog-close" onClick={closeSignIn} aria-label={t('common.close')}>
          <CloseIcon />
        </button>
        <div className="auth-mark" aria-hidden="true">V</div>
        <h2 id="signin-title">{t('auth.title')}</h2>
        <p className="muted">{t('auth.lead')}</p>

        {googleConfigured ? (
          <>
            <div ref={buttonRef} className="google-button" />
            {status === 'loading' && <p className="small muted">{t('common.loading')}</p>}
            {status === 'error' && <p className="field__error">{t('auth.loadError')}</p>}
          </>
        ) : (
          <div className="auth-config-note">
            <strong>{t('auth.previewTitle')}</strong>
            <p>{t('auth.previewBody')}</p>
            <code>VITE_GOOGLE_CLIENT_ID</code>
          </div>
        )}
        <p className="auth-terms">{t('auth.terms')}</p>
      </section>
    </div>
  );
}
