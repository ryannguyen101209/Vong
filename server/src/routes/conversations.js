import crypto from 'node:crypto';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { db } from '../db.js';
import { requireUser } from '../accounts.js';

export const router = express.Router();
router.use(requireUser);
const writeLimit = rateLimit({ windowMs: 60_000, limit: 40, keyGenerator: (req) => req.user.id, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'too_many_messages' } });
const query = `SELECT c.*, l.title_en, l.title_vi, l.image_path, l.price_vnd,
  CASE WHEN c.buyer_id = @user THEN seller.name ELSE buyer.name END AS other_name,
  (SELECT body FROM chat_messages WHERE conversation_id = c.id ORDER BY id DESC LIMIT 1) AS last_message,
  (SELECT COUNT(*) FROM chat_messages m WHERE m.conversation_id = c.id AND m.sender_id <> @user
    AND m.id > CASE WHEN c.buyer_id = @user THEN c.buyer_last_read ELSE c.seller_last_read END) AS unread
  FROM conversations c JOIN listings l ON l.id = c.listing_id
  JOIN users buyer ON buyer.id = c.buyer_id JOIN users seller ON seller.id = c.seller_id`;

router.get('/', (req, res) => {
  const conversations = db.prepare(`${query} WHERE c.buyer_id = @user OR c.seller_id = @user ORDER BY c.updated_at DESC`).all({ user: req.user.id });
  res.json({ conversations });
});

/** Total unread messages across the account's conversations, for the header badge. */
router.get('/unread', (req, res) => {
  const { count } = db.prepare(`SELECT COUNT(*) AS count FROM chat_messages m JOIN conversations c ON c.id = m.conversation_id
    WHERE (c.buyer_id = @user OR c.seller_id = @user) AND m.sender_id <> @user
    AND m.id > CASE WHEN c.buyer_id = @user THEN c.buyer_last_read ELSE c.seller_last_read END`).get({ user: req.user.id });
  res.json({ count });
});

// Whoever loads the latest messages has seen everything up to the newest one.
function markRead(conversation, userId, messageId) {
  const column = conversation.buyer_id === userId ? 'buyer_last_read' : 'seller_last_read';
  db.prepare(`UPDATE conversations SET ${column} = MAX(${column}, ?) WHERE id = ?`).run(messageId, conversation.id);
}

router.post('/', writeLimit, (req, res) => {
  if (typeof req.body?.listingId !== 'string') return res.status(400).json({ error: 'invalid_listing' });
  const listing = db.prepare("SELECT id, seller_id FROM listings WHERE id = ? AND status = 'published' AND is_seed = 0").get(req.body.listingId);
  if (!listing?.seller_id) return res.status(404).json({ error: 'seller_unavailable' });
  if (listing.seller_id === req.user.id) return res.status(409).json({ error: 'own_listing' });
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO conversations (id, listing_id, buyer_id, seller_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(listing_id, buyer_id) DO NOTHING`).run(crypto.randomUUID(), listing.id, req.user.id, listing.seller_id, now, now);
  const conversation = db.prepare(`${query} WHERE c.listing_id = @listing AND c.buyer_id = @user`).get({ user: req.user.id, listing: listing.id });
  res.json({ conversation });
});

router.use('/:id', (req, res, next) => {
  const conversation = db.prepare(`${query} WHERE c.id = @id AND (c.buyer_id = @user OR c.seller_id = @user)`).get({ id: req.params.id, user: req.user.id });
  if (!conversation) return res.status(404).json({ error: 'not_found' });
  req.conversation = conversation;
  next();
});

router.get('/:id/messages', (req, res) => {
  const { before, after } = req.query;
  if ((before && after) || [before, after].some((value) => value !== undefined && (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))))) return res.status(400).json({ error: 'invalid_cursor' });
  const condition = after ? 'AND id > ?' : before ? 'AND id < ?' : '';
  const args = [req.conversation.id];
  if (after || before) args.push(Number(after || before));
  const rows = db.prepare(`SELECT id, sender_id, body, created_at, client_id FROM chat_messages WHERE conversation_id = ? ${condition} ORDER BY id ${after ? 'ASC' : 'DESC'} LIMIT 101`).all(...args);
  const hasMore = rows.length > 100;
  const messages = rows.slice(0, 100);
  if (!after) messages.reverse();
  if (!before) {
    const { newest } = db.prepare('SELECT MAX(id) AS newest FROM chat_messages WHERE conversation_id = ?').get(req.conversation.id);
    if (newest) markRead(req.conversation, req.user.id, newest);
  }
  res.json({ conversation: { ...req.conversation, unread: before ? req.conversation.unread : 0 }, messages, hasMore });
});

router.post('/:id/messages', writeLimit, (req, res) => {
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  const clientId = req.body?.clientId;
  if (!body || body.length > 2000 || typeof clientId !== 'string' || !/^[a-zA-Z0-9-]{8,64}$/.test(clientId)) return res.status(400).json({ error: 'invalid_message' });
  const message = db.transaction(() => {
    const existing = db.prepare('SELECT id, sender_id, body, created_at, client_id FROM chat_messages WHERE conversation_id = ? AND sender_id = ? AND client_id = ?').get(req.conversation.id, req.user.id, clientId);
    if (existing) return existing;
    const now = new Date().toISOString();
    const result = db.prepare('INSERT INTO chat_messages (conversation_id, sender_id, body, client_id, created_at) VALUES (?, ?, ?, ?, ?)').run(req.conversation.id, req.user.id, body, clientId, now);
    db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, req.conversation.id);
    markRead(req.conversation, req.user.id, Number(result.lastInsertRowid));
    return { id: Number(result.lastInsertRowid), sender_id: req.user.id, body, created_at: now, client_id: clientId };
  })();
  res.status(201).json({ message });
});
