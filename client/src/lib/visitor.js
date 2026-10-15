/**
 * One random id per browser (no account, no cookie), used for the daily
 * visitor count and for hearts. The server keeps only hashes of it.
 */
let cached = '';
export function visitorId() {
  if (cached) return cached;
  try {
    cached = localStorage.getItem('vong_visitor') || '';
    if (!cached) { cached = crypto.randomUUID(); localStorage.setItem('vong_visitor', cached); }
  } catch {
    cached = crypto.randomUUID?.() ?? '';
  }
  return cached;
}
