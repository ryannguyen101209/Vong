import crypto from 'node:crypto';
import express from 'express';
import { db } from '../db.js';
import { liveVisitors } from '../presence.js';

/**
 * GET /api/analytics?key=...
 *
 * Private, read-only totals for the owner's dashboard. Counts and sums only:
 * no names, emails, phone numbers or message text ever leave this route.
 * Disabled (404) unless ANALYTICS_KEY is set; the key is compared in constant time.
 */
export const router = express.Router();

const DAYS = 30;
const TZ_SHIFT = '+7 hours'; // count days in Saigon time, not UTC

function keyMatches(given) {
  const expected = process.env.ANALYTICS_KEY || '';
  if (expected.length < 16 || typeof given !== 'string') return false;
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

const count = (sql, ...args) => db.prepare(sql).get(...args).n;

function dailySeries(table, where = '1=1') {
  const rows = db.prepare(`
    SELECT date(created_at, '${TZ_SHIFT}') AS day, COUNT(*) AS n
    FROM ${table}
    WHERE ${where} AND created_at >= ?
    GROUP BY day
  `).all(new Date(Date.now() - (DAYS + 1) * 86_400_000).toISOString());
  return Object.fromEntries(rows.map((r) => [r.day, r.n]));
}

function buildReport() {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const real = 'is_seed = 0';

  const byStatus = Object.fromEntries(
    db.prepare(`SELECT status, COUNT(*) AS n FROM listings WHERE ${real} GROUP BY status`).all()
      .map((r) => [r.status, r.n]),
  );

  const series = {
    listings: dailySeries('listings', real),
    users: dailySeries('users'),
    buy_requests: dailySeries('buy_requests'),
    chat_messages: dailySeries('chat_messages'),
  };
  const days = [];
  const today = new Date(Date.now() + 7 * 3_600_000);
  for (let i = DAYS - 1; i >= 0; i -= 1) {
    const day = new Date(today.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    days.push({
      day,
      listings: series.listings[day] || 0,
      users: series.users[day] || 0,
      buy_requests: series.buy_requests[day] || 0,
      chat_messages: series.chat_messages[day] || 0,
    });
  }

  const group = (column) => db.prepare(`
    SELECT ${column} AS key, COUNT(*) AS n FROM listings
    WHERE ${real} AND status = 'published' GROUP BY ${column} ORDER BY n DESC
  `).all();

  const top = db.prepare(`
    SELECT l.ref, COALESCE(l.title_en, l.title_vi) AS title, l.price_vnd, l.district, l.category,
           l.views, l.published_at,
           (SELECT COUNT(*) FROM buy_requests b WHERE b.listing_id = l.id) AS buy_requests,
           (SELECT COUNT(*) FROM conversations c WHERE c.listing_id = l.id) AS conversations
    FROM listings l
    WHERE l.${real} AND l.status = 'published'
    ORDER BY l.views DESC, l.published_at DESC
    LIMIT 10
  `).all();

  // Fees by month (Saigon time) for listings that were approved: published or later sold.
  const monthly = db.prepare(`
    SELECT strftime('%Y-%m', COALESCE(published_at, created_at), '${TZ_SHIFT}') AS month,
           COALESCE(SUM(fee_vnd), 0) AS fees_vnd, COUNT(*) AS listings,
           SUM(CASE WHEN fee_vnd = 0 THEN 1 ELSE 0 END) AS free_listings
    FROM listings
    WHERE ${real} AND status IN ('published', 'sold')
    GROUP BY month ORDER BY month DESC LIMIT 12
  `).all();

  return {
    generated_at: new Date().toISOString(),
    live_visitors: liveVisitors(),
    monthly,
    listings: {
      by_status: byStatus,
      total: Object.values(byStatus).reduce((s, n) => s + n, 0),
      new_7d: count(`SELECT COUNT(*) AS n FROM listings WHERE ${real} AND created_at >= ?`, weekAgo),
      published_7d: count(`SELECT COUNT(*) AS n FROM listings WHERE ${real} AND published_at >= ?`, weekAgo),
      total_views: count(`SELECT COALESCE(SUM(views), 0) AS n FROM listings WHERE ${real}`),
    },
    fees_vnd: {
      collected: count(`SELECT COALESCE(SUM(fee_vnd), 0) AS n FROM listings WHERE ${real} AND status IN ('published', 'sold')`),
      awaiting_approval: count(`SELECT COALESCE(SUM(fee_vnd), 0) AS n FROM listings WHERE ${real} AND status = 'awaiting_approval'`),
    },
    users: {
      total: count('SELECT COUNT(*) AS n FROM users'),
      new_7d: count('SELECT COUNT(*) AS n FROM users WHERE created_at >= ?', weekAgo),
    },
    engagement: {
      buy_requests: count('SELECT COUNT(*) AS n FROM buy_requests'),
      buy_requests_7d: count('SELECT COUNT(*) AS n FROM buy_requests WHERE created_at >= ?', weekAgo),
      conversations: count('SELECT COUNT(*) AS n FROM conversations'),
      chat_messages: count('SELECT COUNT(*) AS n FROM chat_messages'),
      chat_messages_7d: count('SELECT COUNT(*) AS n FROM chat_messages WHERE created_at >= ?', weekAgo),
      contact_messages: count('SELECT COUNT(*) AS n FROM messages'),
    },
    by_category: group('category'),
    by_district: group('district'),
    top_listings: top,
    daily: days,
  };
}

router.get('/', (req, res) => {
  if (!process.env.ANALYTICS_KEY) return res.status(404).json({ error: 'not_found' });
  res.set('Cache-Control', 'no-store');
  res.set('X-Robots-Tag', 'noindex');
  if (!keyMatches(req.query.key)) return res.status(401).json({ error: 'unauthorized' });
  res.json(buildReport());
});
