import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { api } from '../lib/api.js';
import { useSaved } from '../lib/saved.jsx';
import { visitorId } from '../lib/visitor.js';
import { HeartIcon } from './Icons.jsx';
import { SaveReasonDialog } from './SaveReasonDialog.jsx';

/**
 * Hearting is never one tap: saving opens the reason dialog, un-saving is
 * immediate. `inline` is the larger labelled version used on the detail page.
 * Each save is also a public heart; `likes` is how many people hearted it.
 */
export function SaveButton({ listingId, inline = false, likes = 0 }) {
  const { t } = useI18n();
  const { isSaved, save, remove, entry } = useSaved();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [count, setCount] = useState(likes);
  useEffect(() => setCount(likes), [likes]);
  const saved = isSaved(listingId);
  const sync = (call) => call(listingId, visitorId()).then((r) => setCount(r.likes)).catch(() => {});

  const handleClick = (event) => {
    // The card is a link; hearting should not navigate.
    event.preventDefault();
    event.stopPropagation();
    if (saved) { remove(listingId); setCount((n) => Math.max(0, n - 1)); sync(api.unlike); }
    else setDialogOpen(true);
  };

  return (
    <>
      <button
        type="button"
        className={`save-btn${inline ? ' save-btn--inline' : ''}`}
        data-saved={saved}
        onClick={handleClick}
        aria-pressed={saved}
        title={saved ? t('nav.saved') : t('common.save')}
      >
        <HeartIcon filled={saved} />
        {inline && <span>{saved ? t('nav.saved') : t('common.save')}</span>}
        {count > 0 && <span className="save-btn__count" aria-label={t('listing.hearts', { n: count })}>{count}</span>}
      </button>

      {dialogOpen && (
        <SaveReasonDialog
          existing={entry(listingId)}
          onClose={() => setDialogOpen(false)}
          onSubmit={(reason) => {
            if (!saved) { setCount((n) => n + 1); sync(api.like); }
            save(listingId, reason);
            setDialogOpen(false);
          }}
        />
      )}
    </>
  );
}
