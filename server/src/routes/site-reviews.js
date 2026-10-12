import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { db } from '../db.js';
import { requireUser } from '../accounts.js';
import { notifyOwner } from '../notify.js';
import { shortName } from './sellers.js';

/**
 * Reviews of Vòng itself. One per account; a new or edited review waits for
 * the owner's approval before it appears on the home page.
 */
export const router = express.Router();

/** GET /api/site-reviews — approved reviews (newest first), their average, and the caller's own review. */
router.get('/', (req, res) => {
  const reviews = db.prepare(`
    SELECT r.id, r.rating, r.body, r.created_at, u.name AS reviewer_name
    FROM site_reviews r JOIN users u ON u.id = r.user_id
    WHERE r.status = 'approved' ORDER BY r.created_at DESC LIMIT 12
  `).all().map(({ reviewer_name, ...r }) => ({ ...r, reviewer: shortName(reviewer_name) }));
  const stats = db.prepare("SELECT COUNT(*) AS n, AVG(rating) AS avg FROM site_reviews WHERE status = 'approved'").get();
  const mine = req.user ? db.prepare('SELECT rating, body, status FROM site_reviews WHERE user_id = ?').get(req.user.id) ?? null : null;
  res.json({ reviews, count: stats.n, average: stats.n ? Math.round(stats.avg * 10) / 10 : null, mine });
});

const limit = rateLimit({ windowMs: 60 * 60_000, limit: 10, keyGenerator: (req) => req.user.id, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'too_many_reviews' } });

/** POST /api/site-reviews { rating, body } — write or replace your review; it waits for approval. */
router.post('/', requireUser, limit, (req, res) => {
  const rating = Number(req.body?.rating);
  const body = String(req.body?.body ?? '').trim();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: 'bad_rating' });
  if (body.length < 5 || body.length > 1000) return res.status(400).json({ error: 'bad_body' });

  db.prepare(`INSERT INTO site_reviews (user_id, rating, body, status, created_at) VALUES (?, ?, ?, 'pending', ?)
    ON CONFLICT(user_id) DO UPDATE SET rating = excluded.rating, body = excluded.body, status = 'pending', created_at = excluded.created_at, reviewed_at = NULL`)
    .run(req.user.id, rating, body, new Date().toISOString());
  notifyOwner({ title: `New review of Vòng: ${rating}/5`, message: body.slice(0, 200), tags: ['star'], path: '/admin' });
  res.status(201).json({ ok: true, status: 'pending' });
});
