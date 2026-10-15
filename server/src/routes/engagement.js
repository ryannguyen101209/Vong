import crypto from 'node:crypto';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { db } from '../db.js';
import { requireUser } from '../accounts.js';
import { emailUser } from '../mailer.js';
import { validVisitorId } from '../presence.js';
import { shortName } from './sellers.js';

/**
 * Hearts and public comments on a listing (mounted at /api/listings).
 *
 * Hearts: one per browser, using the same random id as the visitor count, so a
 * heart works without signing in. Only a hash of the id is stored.
 * Comments: public questions like "còn không bạn?", signed-in only, rate
 * limited; the author or the listing's seller can delete one, and so can the admin.
 */
export const router = express.Router();

db.exec(`
  CREATE TABLE IF NOT EXISTS listing_likes (
    listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    liker TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (listing_id, liker)
  ) WITHOUT ROWID;
  CREATE TABLE IF NOT EXISTS listing_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    created_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_comments_listing ON listing_comments(listing_id, id);
`);

/** SQL for a listing's heart count, for listing queries on the `listings` table. */
export const LIKES_COLUMN = '(SELECT COUNT(*) FROM listing_likes k WHERE k.listing_id = listings.id) AS likes';

const likeCount = (id) => db.prepare('SELECT COUNT(*) AS n FROM listing_likes WHERE listing_id = ?').get(id).n;
const likerKey = (visitor) => crypto.createHash('sha256').update(`like:${visitor}`).digest('hex').slice(0, 32);
const openListing = (id, statuses = ['published']) =>
  db.prepare(`SELECT id, seller_id, title_en, title_vi FROM listings WHERE id = ? AND is_seed = 0 AND status IN (${statuses.map(() => '?').join(',')})`).get(id, ...statuses);

const likeLimit = rateLimit({ windowMs: 60 * 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'too_many_likes' } });

/** POST /api/listings/:id/like { visitor } — heart a live listing (once per browser). */
router.post('/:id/like', likeLimit, (req, res) => {
  if (!validVisitorId(req.body?.visitor)) return res.status(400).json({ error: 'bad_visitor' });
  if (!openListing(req.params.id)) return res.status(404).json({ error: 'not_found' });
  db.prepare('INSERT OR IGNORE INTO listing_likes (listing_id, liker, created_at) VALUES (?, ?, ?)')
    .run(req.params.id, likerKey(req.body.visitor), new Date().toISOString());
  res.json({ likes: likeCount(req.params.id), liked: true });
});

/** DELETE /api/listings/:id/like { visitor } — take the heart back. */
router.delete('/:id/like', likeLimit, (req, res) => {
  if (!validVisitorId(req.body?.visitor)) return res.status(400).json({ error: 'bad_visitor' });
  db.prepare('DELETE FROM listing_likes WHERE listing_id = ? AND liker = ?').run(req.params.id, likerKey(req.body.visitor));
  res.json({ likes: likeCount(req.params.id), liked: false });
});

/** GET /api/listings/:id/comments — public comments, oldest first. */
router.get('/:id/comments', (req, res) => {
  const listing = openListing(req.params.id, ['published', 'sold']);
  if (!listing) return res.status(404).json({ error: 'not_found' });
  const comments = db.prepare(`
    SELECT c.id, c.body, c.created_at, c.user_id, u.name, u.admin_at IS NOT NULL AS admin
    FROM listing_comments c JOIN users u ON u.id = c.user_id
    WHERE c.listing_id = ? AND c.deleted_at IS NULL ORDER BY c.id LIMIT 200
  `).all(listing.id).map(({ user_id, name, admin, ...c }) => ({
    ...c,
    author: shortName(name),
    seller: user_id === listing.seller_id,
    admin: Boolean(admin),
    mine: Boolean(req.user && req.user.id === user_id),
    can_delete: Boolean(req.user && (req.user.id === user_id || req.user.id === listing.seller_id)),
  }));
  res.json({ comments });
});

const commentLimit = rateLimit({ windowMs: 10 * 60_000, limit: 10, keyGenerator: (req) => req.user.id, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'too_many_comments' } });

// The seller hears about new comments by email, at most once per listing every few hours.
const COMMENT_EMAIL_COOLDOWN_MS = 3 * 60 * 60_000;
const lastCommentEmail = new Map();

/** POST /api/listings/:id/comments { body } — ask or answer in public. */
router.post('/:id/comments', requireUser, commentLimit, (req, res) => {
  const listing = openListing(req.params.id);
  if (!listing) return res.status(404).json({ error: 'not_found' });
  const body = String(req.body?.body ?? '').trim().replace(/\n{3,}/g, '\n\n');
  if (body.length < 1 || body.length > 500) return res.status(400).json({ error: 'bad_body' });

  const now = new Date();
  const { lastInsertRowid } = db.prepare('INSERT INTO listing_comments (listing_id, user_id, body, created_at) VALUES (?, ?, ?, ?)')
    .run(listing.id, req.user.id, body, now.toISOString());

  if (listing.seller_id && listing.seller_id !== req.user.id) {
    const last = lastCommentEmail.get(listing.id) ?? 0;
    if (now.getTime() - last > COMMENT_EMAIL_COOLDOWN_MS) {
      lastCommentEmail.set(listing.id, now.getTime());
      const seller = db.prepare('SELECT email FROM users WHERE id = ?').get(listing.seller_id);
      emailUser(seller?.email, 'new_comment', { titleVi: listing.title_vi, titleEn: listing.title_en, body, listingId: listing.id, fromName: shortName(req.user.name) });
    }
  }
  res.status(201).json({ id: Number(lastInsertRowid) });
});

/** DELETE /api/listings/:id/comments/:commentId — by its author or the listing's seller. */
router.delete('/:id/comments/:commentId', requireUser, (req, res) => {
  const row = db.prepare(`SELECT c.id, c.user_id, l.seller_id FROM listing_comments c JOIN listings l ON l.id = c.listing_id
    WHERE c.id = ? AND c.listing_id = ? AND c.deleted_at IS NULL`).get(Number(req.params.commentId), req.params.id);
  if (!row) return res.status(404).json({ error: 'not_found' });
  if (req.user.id !== row.user_id && req.user.id !== row.seller_id) return res.status(403).json({ error: 'forbidden' });
  db.prepare('UPDATE listing_comments SET deleted_at = ? WHERE id = ?').run(new Date().toISOString(), row.id);
  res.json({ ok: true });
});

/** For the admin: remove any comment. */
export function adminDeleteComment(id) {
  return db.prepare('UPDATE listing_comments SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL').run(new Date().toISOString(), Number(id)).changes > 0;
}
