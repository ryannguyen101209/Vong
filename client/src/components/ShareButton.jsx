import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { ShareIcon, CheckIcon } from './Icons.jsx';

/**
 * Opens the phone's share sheet (Zalo, Messenger, Facebook…) where there is one,
 * and copies the link everywhere else. The shared link carries the listing's
 * own photo and price, so every share works as an advert for the item.
 */
export function ShareButton({ url, title, text, small = false }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const field = document.createElement('textarea');
      field.value = url;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      document.execCommand('copy');
      field.remove();
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2200);
  };

  const share = async () => {
    if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return; // they closed the sheet
      }
    }
    copy();
  };

  return (
    <button type="button" className={small ? 'btn btn--ghost btn--small' : 'save-btn save-btn--inline'} onClick={share} aria-live="polite">
      {copied ? <CheckIcon /> : <ShareIcon />}
      <span>{copied ? t('listing.linkCopied') : t('listing.share')}</span>
    </button>
  );
}
