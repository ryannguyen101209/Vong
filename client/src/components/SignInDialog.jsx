import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { useAuth } from '../lib/auth.jsx';
import { CloseIcon } from './Icons.jsx';
import { LogoMark } from './Logo.jsx';

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
    script.onerror = (error) => { script.remove(); reject(error); };
    document.head.appendChild(script);
  });
}

export function SignInDialog() {
  const { t } = useI18n();
  const { signInOpen, closeSignIn, completeGoogleSignIn, googleConfigured, googleClientId, authError } = useAuth();
  const buttonRef = useRef(null);
  const dialogRef = useRef(null);
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    if (!signInOpen || !googleConfigured || !buttonRef.current) return undefined;
    let active = true;
    setStatus('loading');
    loadGoogleIdentity()
      .then((google) => {
        if (!active) return;
        google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async ({ credential }) => {
            if (!active) return;
            setStatus('loading');
            await completeGoogleSignIn(credential);
            if (active) setStatus('ready');
          },
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
  }, [signInOpen, googleConfigured, googleClientId, completeGoogleSignIn]);

  useEffect(() => {
    if (!signInOpen) return;
    const previous = document.activeElement;
    dialogRef.current?.querySelector('button')?.focus();
    const keyboard = (event) => {
      if (event.key === 'Escape') closeSignIn();
      if (event.key !== 'Tab') return;
      const items = [...dialogRef.current.querySelectorAll('button, iframe, [tabindex="0"]')];
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('keydown', keyboard); previous?.focus(); };
  }, [signInOpen, closeSignIn]);

  if (!signInOpen) return null;

  return (
    <div className="dialog-backdrop auth-backdrop" role="presentation" onMouseDown={closeSignIn}>
      <section ref={dialogRef} className="dialog auth-dialog" role="dialog" aria-modal="true" aria-labelledby="signin-title" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="icon-btn dialog-close" onClick={closeSignIn} aria-label={t('common.close')}>
          <CloseIcon />
        </button>
        <span className="brand" aria-hidden="true"><LogoMark size={36} /></span>
        <h2 id="signin-title">{t('auth.title')}</h2>
        <p>{t('auth.lead')}</p>

        {googleConfigured ? (
          <>
            <div ref={buttonRef} className="google-button" />
            {status === 'loading' && <p className="small muted">{t('common.loading')}</p>}
            {status === 'error' && <p className="field__error">{t('auth.loadError')}</p>}
          </>
        ) : (
          <div className="notice auth-config-note">
            <p className="notice__title">{t('auth.previewTitle')}</p>
            <p>{t('auth.previewBody')}</p>
          </div>
        )}
        {authError && <p role="alert" className="field__error">{t('auth.loadError')}</p>}
        <p className="auth-terms">{t('auth.terms')}</p>
      </section>
    </div>
  );
}
