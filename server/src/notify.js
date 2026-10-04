/**
 * Push alerts to the owner's phone through ntfy (https://ntfy.sh).
 *
 * Off unless NTFY_TOPIC is set. The topic name is the only secret: anyone who
 * knows it can read the alerts, so pick something long and random. Alerts carry
 * only the listing title, price and status, never a seller's phone or email.
 * Fire-and-forget: a failure here must never break a seller's request.
 */
const TIMEOUT_MS = 5000;

export function notifyOwner({ title, message, tags = [], path = '/admin' }) {
  const topic = process.env.NTFY_TOPIC?.trim();
  if (!topic) return;

  const server = (process.env.NTFY_SERVER || 'https://ntfy.sh').replace(/\/+$/, '');
  const site = (process.env.PUBLIC_URL || 'https://usevong.com').replace(/\/+$/, '');

  fetch(server, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, title, message, tags, click: site + path }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => {});
}
