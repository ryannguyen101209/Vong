import { useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { useSaved } from '../lib/saved.jsx';
import { HeartIcon } from './Icons.jsx';
import { SaveReasonDialog } from './SaveReasonDialog.jsx';

/**
 * Hearting is never one tap: saving opens the reason dialog, un-saving is
 * immediate. `inline` is the larger labelled version used on the detail page.
 */
export function SaveButton({ listingId, inline = false }) {
  const { t } = useI18n();
  const { isSaved, save, remove, entry } = useSaved();
  const [dialogOpen, setDialogOpen] = useState(false);
  const saved = isSaved(listingId);

  const handleClick = (event) => {
    // The card is a link; hearting should not navigate.
    event.preventDefault();
    event.stopPropagation();
    if (saved) remove(listingId);
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
      </button>

      {dialogOpen && (
        <SaveReasonDialog
          existing={entry(listingId)}
          onClose={() => setDialogOpen(false)}
          onSubmit={(reason) => {
            save(listingId, reason);
            setDialogOpen(false);
          }}
        />
      )}
    </>
  );
}
