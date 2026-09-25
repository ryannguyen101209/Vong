/** Prices are always in dong; only the digit grouping follows the UI language. */
export function formatPrice(amount, lang = 'en') {
  const number = Number(amount) || 0;
  const locale = lang === 'vi' ? 'vi-VN' : 'en-US';
  return `${new Intl.NumberFormat(locale).format(number)} ₫`;
}

export function formatDate(iso, lang = 'en') {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(iso, lang = 'en') {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** Digits only, grouped, for the fee input in admin settings. */
export function digitsOnly(value) {
  return String(value ?? '').replace(/[^\d]/g, '');
}

/** "2 hours ago" / "2 giờ trước", for post times in the feed. */
export function formatRelative(iso, lang = 'en') {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
  const rtf = new Intl.RelativeTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-GB', { numeric: 'auto' });
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(0, 'minute');
}
