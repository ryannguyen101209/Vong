/**
 * Push alerts to the owner's phone through ntfy (https://ntfy.sh).
 *
 * Off unless NTFY_TOPIC is set. The topic name is the only secret: anyone who
 * knows it can read the alerts, so pick something long and random. Alerts carry
 * only the listing title, price and status, never a seller's phone or email.
 * Fire-and-forget: a failure here must never break a seller's request, but it
 * is logged (without the topic) and remembered, so the admin can see why.
 *
 * ntfy.sh limits anonymous senders by IP address, and a host like Render shares
 * its addresses with many other sites. NTFY_TOKEN (an access token from a free
 * ntfy.sh account) makes the limits the account's own.
 */
const TIMEOUT_MS = 5000;

let last = null; // { at, ok, status, error } of the most recent attempt

/** The most recent attempt, for the admin panel. Null until one is made. */
export const lastNotify = () => last;

export const notifyConfigured = () => Boolean(process.env.NTFY_TOPIC?.trim());

/** What went wrong, in words the admin panel can show. */
function describe(status, body) {
  const detail = String(body?.error ?? '').slice(0, 160);
  if (status === 429) return `rate_limited${detail ? `: ${detail}` : ''}`;
  if (status === 401 || status === 403) return `not_allowed${detail ? `: ${detail}` : ''}`;
  return `http_${status}${detail ? `: ${detail}` : ''}`;
}

/** Send one alert. Resolves to { ok, status, error }; never throws. */
export function notifyOwner({ title, message, tags = [], path = '/admin' }) {
  const topic = process.env.NTFY_TOPIC?.trim();
  if (!topic) return Promise.resolve({ ok: false, status: 0, error: 'not_configured' });

  const server = (process.env.NTFY_SERVER || 'https://ntfy.sh').replace(/\/+$/, '');
  const site = (process.env.PUBLIC_URL || 'https://usevong.com').replace(/\/+$/, '');
  const token = process.env.NTFY_TOKEN?.trim();

  const record = (result) => {
    last = { at: new Date().toISOString(), ...result };
    if (!result.ok) console.error(`[ntfy] alert "${String(title).slice(0, 60)}" not delivered: ${result.error}`);
    return result;
  };

  return fetch(server, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ topic, title, message, tags, click: site + path }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
    .then(async (response) => {
      if (response.ok) return record({ ok: true, status: response.status, error: null });
      let body = null;
      try { body = await response.json(); } catch { body = null; }
      return record({ ok: false, status: response.status, error: describe(response.status, body) });
    })
    .catch((error) => record({ ok: false, status: 0, error: error?.name === 'TimeoutError' ? 'timeout' : 'unreachable' }));
}
