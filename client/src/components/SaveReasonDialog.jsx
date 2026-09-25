import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { SAVE_REASONS } from '../lib/saved.jsx';

/**
 * Asks why something is being saved. The reason is the point of the Saved page:
 * six weeks later "good price" and "waiting for payday" mean different things.
 */
export function SaveReasonDialog({ existing, onSubmit, onClose }) {
  const { t } = useI18n();
  const [reasonKey, setReasonKey] = useState(existing?.reasonKey ?? null);
  const [note, setNote] = useState(existing?.note ?? '');
  const dialogRef = useRef(null);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    dialogRef.current?.querySelector('button, textarea')?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const submit = (event) => {
    event.preventDefault();
    // A written note wins over a chip: it is the more specific answer.
    onSubmit({ reasonKey: note.trim() ? null : reasonKey, note });
  };

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="dialog save-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-dialog-title"
        aria-describedby="save-dialog-lead"
        ref={dialogRef}
      >
        <h2 id="save-dialog-title">{t('saveDialog.title')}</h2>
        <p id="save-dialog-lead" className="save-dialog__lead">{t('saveDialog.lead')}</p>

        <form onSubmit={submit} className="save-dialog__form">
          <div className="chip-row save-dialog__chips" role="group" aria-labelledby="save-dialog-title">
            {SAVE_REASONS.map((key) => (
              <button
                key={key}
                type="button"
                className="chip"
                aria-pressed={reasonKey === key && !note.trim()}
                onClick={() => {
                  setReasonKey(key === reasonKey ? null : key);
                  setNote('');
                }}
              >
                {t(`saveDialog.${key}`)}
              </button>
            ))}
          </div>

          <div className="field">
            <label className="field__label" htmlFor="save-note">
              {t('saveDialog.noteLabel')} <span className="save-dialog__optional">({t('common.optional')})</span>
            </label>
            <textarea
              id="save-note"
              className="textarea save-dialog__note"
              rows={2}
              placeholder={t('saveDialog.notePlaceholder')}
              value={note}
              maxLength={200}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          <div className="save-dialog__actions">
            <button type="button" className="btn" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn--primary" disabled={!reasonKey && !note.trim()}>
              {existing ? t('saveDialog.update') : t('saveDialog.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Renders a saved entry's reason, whichever form it took. */
export function reasonLabel(entry, t) {
  if (!entry) return '';
  if (entry.note) return entry.note;
  if (entry.reasonKey) return t(`saveDialog.${entry.reasonKey}`);
  return '';
}
