import crypto from 'node:crypto';
import express from 'express';
import { db, getSettings } from '../db.js';
import { liveVisitors } from '../presence.js';

/**
 * GET /api/analytics?key=...
 *
 * Private, read-only totals. The admin panel's Analytics tab reads the same report from
 * GET /api/admin/analytics (admin login); this key route is kept for scripts. Counts and sums only:
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

/** Emails in the "don't count in stats" setting: the team's own and test accounts. */
export function excludedEmails() {
  return String(getSettings().stats_exclude_emails ?? '').split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
}

const sqlList = (values) => (values.length ? `(${values.map((v) => `'${String(v).replace(/'/g, "''")}'`).join(', ')})` : "('')");

export function buildReport() {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  // Accounts left out of every number: their listings, chats and sign-ups.
  const emails = excludedEmails();
  const ids = emails.length
    ? db.prepare(`SELECT id FROM users WHERE lower(email) IN ${sqlList(emails)}`).all().map((r) => r.id)
    : [];
  // A column whose account is not one of those (an empty value, like a listing from before accounts, counts).
  const notOut = (column) => (ids.length ? `(${column} IS NULL OR ${column} NOT IN ${sqlList(ids)})` : '1 = 1');
  const real = `is_seed = 0 AND ${notOut('seller_id')}`;
  const realUser = notOut('id');
  const realChat = `${notOut('buyer_id')} AND ${notOut('seller_id')}`;
  const realRequest = `listing_id IN (SELECT id FROM listings WHERE ${real})`;
  const realContact = emails.length ? `lower(email) NOT IN ${sqlList(emails)}` : '1 = 1';

  const byStatus = Object.fromEntries(
    db.prepare(`SELECT status, COUNT(*) AS n FROM listings WHERE ${real} GROUP BY status`).all()
      .map((r) => [r.status, r.n]),
  );

  const series = {
    listings: dailySeries('listings', real),
    users: dailySeries('users', realUser),
    buy_requests: dailySeries('buy_requests', realRequest),
    conversations: dailySeries('conversations', realChat),
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
      conversations: series.conversations[day] || 0,
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

  const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();

  // Each city: live listings, new in the last 30 days, sold, and views.
  const cities = db.prepare(`
    SELECT COALESCE(city, 'ho_chi_minh') AS city,
           SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS live,
           SUM(CASE WHEN created_at >= @monthAgo THEN 1 ELSE 0 END) AS new_30d,
           SUM(CASE WHEN status = 'sold' THEN 1 ELSE 0 END) AS sold,
           COALESCE(SUM(views), 0) AS views
    FROM listings WHERE ${real} GROUP BY 1 ORDER BY live DESC, new_30d DESC, city
  `).all({ monthAgo });

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
    sold: {
      total: count(`SELECT COUNT(*) AS n FROM listings WHERE ${real} AND status = 'sold'`),
      last_30d: count(`SELECT COUNT(*) AS n FROM listings WHERE ${real} AND status = 'sold' AND sold_at >= ?`, monthAgo),
    },
    // People selling right now, and those who listed for the first time this week.
    sellers: {
      active: count(`SELECT COUNT(DISTINCT seller_id) AS n FROM listings WHERE ${real} AND status = 'published' AND seller_id IS NOT NULL`),
      new_7d: count(`SELECT COUNT(*) AS n FROM (SELECT seller_id FROM listings WHERE ${real} AND seller_id IS NOT NULL GROUP BY seller_id HAVING MIN(created_at) >= ?)`, weekAgo),
    },
    cities,
    users: {
      total: count(`SELECT COUNT(*) AS n FROM users WHERE ${realUser}`),
      new_7d: count(`SELECT COUNT(*) AS n FROM users WHERE ${realUser} AND created_at >= ?`, weekAgo),
      // New accounts per day (Saigon time) since the first one, for the growth chart. Days with none are left out.
      by_day: db.prepare(`SELECT date(created_at, '${TZ_SHIFT}') AS day, COUNT(*) AS n FROM users WHERE ${realUser} GROUP BY day ORDER BY day`).all(),
    },
    engagement: {
      buy_requests: count(`SELECT COUNT(*) AS n FROM buy_requests WHERE ${realRequest}`),
      buy_requests_7d: count(`SELECT COUNT(*) AS n FROM buy_requests WHERE ${realRequest} AND created_at >= ?`, weekAgo),
      conversations: count(`SELECT COUNT(*) AS n FROM conversations WHERE ${realChat}`),
      conversations_7d: count(`SELECT COUNT(*) AS n FROM conversations WHERE ${realChat} AND created_at >= ?`, weekAgo),
      // Different people who have messaged a seller, however many messages they sent.
      buyers: count(`SELECT COUNT(DISTINCT buyer_id) AS n FROM conversations WHERE ${realChat}`),
      buyers_7d: count(`SELECT COUNT(DISTINCT buyer_id) AS n FROM conversations WHERE ${realChat} AND created_at >= ?`, weekAgo),
      contact_messages: count(`SELECT COUNT(*) AS n FROM messages WHERE ${realContact}`),
    },
    excluded_accounts: ids.length,
    by_category: group('category'),
    by_city: group('city'),
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
