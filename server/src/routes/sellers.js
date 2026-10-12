import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { db } from '../db.js';
import { requireUser } from '../accounts.js';
import { notifyOwner } from '../notify.js';

/**
 * Public seller profiles and seller reviews.
 *
 * Only a buyer who messaged a seller about one of their listings, and got a
 * reply, can review that seller, once per listing. That keeps reviews tied to
 * real conversations instead of anyone rating anyone.
 */
export const router = express.Router();

/** "Nguyễn Văn Linh" -> "Nguyễn L.": enough to tell reviewers apart without a full name. */
export function shortName(name) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts.at(-1)[0].toUpperCase()}.`;
}

/** Badge, rating and counts shown wherever a seller appears. */
export function sellerSummary(sellerId) {
  if (!sellerId) return null;
  const user = db.prepare('SELECT id, name, created_at, trusted_at FROM users WHERE id = ?').get(sellerId);
  if (!user) return null;
  const rating = db.prepare('SELECT COUNT(*) AS n, AVG(rating) AS avg FROM seller_reviews WHERE seller_id = ?').get(sellerId);
  const latestName = db.prepare(
    "SELECT seller_name FROM listings WHERE seller_id = ? AND is_seed = 0 AND status IN ('published', 'sold') ORDER BY created_at DESC LIMIT 1",
  ).get(sellerId)?.seller_name;
  return {
    id: user.id,
    name: latestName || shortName(user.name),
    member_since: user.created_at,
    trusted: Boolean(user.trusted_at),
    rating_count: rating.n,
    rating_avg: rating.n ? Math.round(rating.avg * 10) / 10 : null,
  };
}

/** Listings by this seller that the signed-in user may still review. */
function reviewableListings(sellerId, userId) {
  if (!userId || userId === sellerId) return [];
  return db.prepare(`
    SELECT DISTINCT l.id, l.title_en, l.title_vi
    FROM conversations c
    JOIN listings l ON l.id = c.listing_id
    WHERE c.seller_id = @seller AND c.buyer_id = @user AND l.is_seed = 0
      AND EXISTS (SELECT 1 FROM chat_messages m WHERE m.conversation_id = c.id AND m.sender_id = @seller)
      AND NOT EXISTS (SELECT 1 FROM seller_reviews r WHERE r.reviewer_id = @user AND r.listing_id = l.id)
  `).all({ seller: sellerId, user: userId });
}

const PROFILE_LISTING_COLUMNS = `
  id, ref, title_en, title_vi, description_en, description_vi, category, price_vnd, city, district,
  condition, seller_name, image_path, images, status, views, created_at, published_at, seller_id
`;

/** GET /api/sellers/:id — the public profile: summary, live and sold listings, reviews. */
router.get('/:id', (req, res) => {
  const seller = sellerSummary(req.params.id);
  // A profile exists once the seller has something public; accounts that never listed stay private.
  const listings = seller
    ? db.prepare(`SELECT ${PROFILE_LISTING_COLUMNS} FROM listings
        WHERE seller_id = ? AND is_seed = 0 AND status IN ('published', 'sold')
        ORDER BY (status = 'published') DESC, COALESCE(published_at, created_at) DESC LIMIT 60`).all(req.params.id)
    : [];
  if (!seller || listings.length === 0) return res.status(404).json({ error: 'not_found' });

  const reviews = db.prepare(`
    SELECT r.id, r.rating, r.body, r.created_at, u.name AS reviewer_name, l.title_en, l.title_vi
    FROM seller_reviews r JOIN users u ON u.id = r.reviewer_id JOIN listings l ON l.id = r.listing_id
    WHERE r.seller_id = ? ORDER BY r.created_at DESC LIMIT 100
  `).all(req.params.id).map(({ reviewer_name, ...r }) => ({ ...r, reviewer: shortName(reviewer_name) }));

  res.json({
    seller: { ...seller, sold_count: listings.filter((l) => l.status === 'sold').length },
    listings: listings.map((row) => {
      let images = [];
      try { images = JSON.parse(row.images || '[]'); } catch { images = []; }
      return { ...row, images: images.length ? images : row.image_path ? [row.image_path] : [] };
    }),
    reviews,
    can_review: reviewableListings(req.params.id, req.user?.id),
  });
});

const reviewLimit = rateLimit({ windowMs: 60 * 60_000, limit: 10, keyGenerator: (req) => req.user.id, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'too_many_reviews' } });

/** POST /api/sellers/:id/reviews { listing_id, rating, body } — review a seller you dealt with. */
router.post('/:id/reviews', requireUser, reviewLimit, (req, res) => {
  const rating = Number(req.body?.rating);
  const body = String(req.body?.body ?? '').trim();
  const listingId = String(req.body?.listing_id ?? '');
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: 'bad_rating' });
  if (body.length < 5 || body.length > 1000) return res.status(400).json({ error: 'bad_body' });
  if (req.user.id === req.params.id) return res.status(403).json({ error: 'own_profile' });
  if (!reviewableListings(req.params.id, req.user.id).some((l) => l.id === listingId)) {
    return res.status(403).json({ error: 'not_eligible' });
  }

  db.prepare('INSERT INTO seller_reviews (seller_id, reviewer_id, listing_id, rating, body, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(req.params.id, req.user.id, listingId, rating, body, new Date().toISOString());
  notifyOwner({ title: `New seller review: ${rating}/5`, message: body.slice(0, 200), tags: ['star'], path: `/seller/${req.params.id}` });
  res.status(201).json({ ok: true, seller: sellerSummary(req.params.id) });
});
