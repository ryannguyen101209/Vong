/**
 * Live visitor count. Each open browser tab sends a random id every 30 seconds.
 * The ids live only in memory (never in the database), carry no personal data,
 * and expire after 60 seconds without a ping. A restart resets the count.
 */
const WINDOW_MS = 60_000;
const MAX_TRACKED = 5000;
const seen = new Map();

export const validVisitorId = (id) => typeof id === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(id);

function prune(now) {
  for (const [id, at] of seen) if (now - at > WINDOW_MS) seen.delete(id);
}

export function touchVisitor(id, now = Date.now()) {
  if (!validVisitorId(id)) return false;
  if (seen.size >= MAX_TRACKED) prune(now);
  if (seen.size >= MAX_TRACKED && !seen.has(id)) return false;
  seen.set(id, now);
  return true;
}

export function liveVisitors(now = Date.now()) {
  prune(now);
  return seen.size;
}
