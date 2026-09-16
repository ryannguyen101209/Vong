import { useId } from 'react';

/** Label + control + hint/error, so every form in the app looks the same. */
export function Field({ label, hint, error, required = false, children }) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ');

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
        {required && <span aria-hidden="true" style={{ color: 'var(--accent)' }}> *</span>}
      </label>
      {children({ id, 'aria-describedby': describedBy || undefined, 'aria-invalid': error ? 'true' : undefined })}
      {hint && !error && <span className="field__hint" id={`${id}-hint`}>{hint}</span>}
      {error && <span className="field__error" id={`${id}-error`}>{error}</span>}
    </div>
  );
}
