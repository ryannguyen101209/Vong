import { useState } from 'react';

/** Stable tint per name, so the same person keeps the same colour. */
function tintFor(name = '') {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)) >>> 0;
  return (hash % 6) + 1;
}

/** First and last initials, which reads right for "Linh Trần" and "Trần Thị Linh" alike. */
function initialFor(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const letters = parts.length === 1 ? parts[0][0] : parts[0][0] + parts.at(-1)[0];
  return letters.toUpperCase();
}

export function Avatar({ name, picture, size = 'md' }) {
  const [broken, setBroken] = useState(false);
  const className = `avatar${size === 'md' ? '' : ` avatar--${size}`}`;
  if (picture && !broken) {
    return (
      <span className={className} aria-hidden="true">
        <img src={picture} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      </span>
    );
  }
  return <span className={className} data-tint={tintFor(name)} aria-hidden="true">{initialFor(name)}</span>;
}
