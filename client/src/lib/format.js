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
