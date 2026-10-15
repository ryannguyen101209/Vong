import crypto from 'node:crypto';
import { db } from './db.js';

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

/*
 * Daily visitors. Each browser keeps one random id (no account, no cookie). The
 * database stores only a hash of that id mixed with the day, so a visitor can be
 * counted once per day but never followed from one day to the next. Rows older
 * than about a year are deleted.
 */
db.exec(`CREATE TABLE IF NOT EXISTS visitor_days (
  day TEXT NOT NULL, visitor TEXT NOT NULL, PRIMARY KEY (day, visitor)) WITHOUT ROWID`);

const saigonDay = (now) => new Date(now + 7 * 3_600_000).toISOString().slice(0, 10);
const recorded = new Set(); // "day:hash" already written, so a ping every 30 s is not a write every 30 s
let lastPrune = 0;

export function recordDailyVisitor(id, now = Date.now()) {
  if (!validVisitorId(id)) return false;
  const day = saigonDay(now);
  const visitor = crypto.createHash('sha256').update(`${day}:${id}`).digest('hex').slice(0, 32);
  const key = `${day}:${visitor}`;
  if (recorded.has(key)) return true;
  if (recorded.size > 20000) recorded.clear();
  recorded.add(key);
  db.prepare('INSERT OR IGNORE INTO visitor_days (day, visitor) VALUES (?, ?)').run(day, visitor);
  if (now - lastPrune > 86_400_000) {
    lastPrune = now;
    db.prepare('DELETE FROM visitor_days WHERE day < ?').run(saigonDay(now - 400 * 86_400_000));
  }
  return true;
}

/** Different visitors per day (Saigon time), as { "2026-10-15": 42, ... }. */
export function visitorsByDay(sinceDay) {
  return Object.fromEntries(
    db.prepare('SELECT day, COUNT(*) AS n FROM visitor_days WHERE day >= ? GROUP BY day').all(sinceDay).map((r) => [r.day, r.n]),
  );
}
