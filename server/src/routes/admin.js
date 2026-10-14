import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { db, getSettings, saveSettings } from '../db.js';
import { login, logout, requireAdmin, usingDefaultPassword } from '../auth.js';
import { BANKS, findBank } from '../vietqr.js';
import { emailUser, mailEnabled, sendMail, buildContactReply, buildSellerNote, inboxAddress } from '../mailer.js';
import { buildReport } from './analytics.js';
import { notifyOwner, notifyConfigured, lastNotify } from '../notify.js';
import { snapshot, backupFilename, backupEmail, lastEmailedBackup, emailBackup } from '../backup.js';
import { CITIES } from '../seed-data.js';

/** Who to tell about a listing: the signed-in seller's account email, else the listing's email. */
function sellerEmailFor(id) {
  const r = db.prepare('SELECT l.title_en, l.title_vi, COALESCE(u.email, l.seller_email) AS email FROM listings l LEFT JOIN users u ON u.id = l.seller_id WHERE l.id = ?').get(id);
  return r ?? null;
}

export const router = express.Router();

// Wrong passwords only: 10 per 15 minutes per address, so the password cannot be guessed by brute force.
const loginLimit = rateLimit({ windowMs: 15 * 60_000, limit: 10, skipSuccessfulRequests: true, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'too_many_attempts' } });

/** POST /api/admin/login — password in, bearer token out. */
router.post('/login', loginLimit, (req, res) => {
  const session = login(req.body?.password);
  if (!session) return res.status(401).json({ error: 'bad_password' });
  res.json({ ...session, default_password: usingDefaultPassword() });
});

router.post('/logout', requireAdmin, (req, res) => {
  logout((req.get('authorization') || '').slice(7));
  res.json({ ok: true });
});

router.use(requireAdmin);

const ADMIN_COLUMNS = `
  id, ref, title_en, title_vi, description_en, description_vi, category, price_vnd,
  city, district, condition, seller_name, seller_phone, seller_email, image_path, status, reject_reason,
  fee_vnd, views, created_at, paid_marked_at, payment_verified_at, reviewed_at, published_at, edited_at, seller_id,
  (SELECT trusted_at IS NOT NULL FROM users WHERE users.id = listings.seller_id) AS seller_trusted,
  (SELECT COUNT(*) FROM listings o
     WHERE o.seller_id = listings.seller_id AND o.is_seed = 0 AND o.id <> listings.id
       AND (o.created_at < listings.created_at OR (o.created_at = listings.created_at AND o.id < listings.id))
  ) = 0 AND listings.seller_id IS NOT NULL AS is_first_listing,
  (SELECT COUNT(*) FROM listings o WHERE o.seller_id = listings.seller_id AND o.is_seed = 0) AS seller_total,
  CASE WHEN listings.seller_id IS NULL THEN NULL ELSE 1 + (SELECT COUNT(*) FROM listings o
     WHERE o.seller_id = listings.seller_id AND o.is_seed = 0 AND o.id <> listings.id
       AND (o.created_at < listings.created_at OR (o.created_at = listings.created_at AND o.id < listings.id))
  ) END AS seller_index
`;

/** GET /api/admin/analytics — counts and sums for the Analytics tab. No personal data. */
router.get('/analytics', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(buildReport());
});

/** GET /api/admin/listings?status=... — the review queue. */
router.get('/listings', (req, res) => {
  const status = String(req.query.status ?? 'awaiting_approval');
  const statuses = ['pending_payment', 'awaiting_approval', 'published', 'rejected'];
  // Optional: only listings in one city.
  const city = CITIES.includes(String(req.query.city)) ? String(req.query.city) : null;
  const inCity = city ? ' AND city = @city' : '';

  // "queue" = everything that needs you: paid-and-claimed first, then waiting-for-payment.
  const rows = status === 'queue'
    ? db.prepare(`SELECT ${ADMIN_COLUMNS} FROM listings WHERE status IN ('awaiting_approval','pending_payment')${inCity}
        ORDER BY (status = 'awaiting_approval') DESC, COALESCE(paid_marked_at, created_at) ASC`).all({ city })
    : statuses.includes(status)
    ? db.prepare(`SELECT ${ADMIN_COLUMNS} FROM listings WHERE status = @status${inCity} ORDER BY COALESCE(paid_marked_at, created_at) ASC`).all({ status, city })
    : db.prepare(`SELECT ${ADMIN_COLUMNS} FROM listings WHERE 1 = 1${inCity} ORDER BY created_at DESC`).all({ city });

  // How many listings with this status each city has, for the city filter.
  const cityCounts = Object.fromEntries(
    db.prepare(`SELECT COALESCE(city, 'ho_chi_minh') AS city, COUNT(*) AS n FROM listings
      WHERE is_seed = 0${statuses.includes(status) ? ' AND status = @status' : ''} GROUP BY 1`).all({ status })
      .map((r) => [r.city, r.n]),
  );

  const counts = Object.fromEntries(statuses.map((s) => [s, 0]));
  for (const row of db.prepare('SELECT status, COUNT(*) AS n FROM listings GROUP BY status').all()) {
    counts[row.status] = row.n;
  }

  const free_given = db.prepare('SELECT COUNT(*) AS n FROM listings WHERE is_seed = 0 AND fee_vnd = 0').get().n;

  res.json({ listings: rows.map((r) => ({ ...r, is_first_listing: !!r.is_first_listing })), counts, free_given, city_counts: cityCounts });
});

/**
 * GET /api/admin/users?q= — every account, newest first: name, Google email,
 * when they joined, how many listings they have posted, and the trusted badge.
 * `q` matches name or email. Admin only, never public.
 */
router.get('/users', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const q = String(req.query.q ?? '').trim().toLowerCase().slice(0, 100);
  const users = db.prepare(`
    SELECT u.id, u.name, u.email, u.created_at, u.trusted_at IS NOT NULL AS trusted,
           (SELECT COUNT(*) FROM listings l WHERE l.seller_id = u.id AND l.is_seed = 0 AND l.status <> 'removed') AS listings,
           (SELECT COUNT(*) FROM listings l WHERE l.seller_id = u.id AND l.is_seed = 0 AND l.status IN ('published', 'sold')) AS public_listings
    FROM users u
    WHERE @q = '' OR instr(lower(u.name), @q) > 0 OR instr(lower(u.email), @q) > 0
    ORDER BY u.created_at DESC
  `).all({ q }).map((u) => ({ ...u, trusted: Boolean(u.trusted) }));
  res.json({ users, total: db.prepare('SELECT COUNT(*) AS n FROM users').get().n });
});

/** POST /api/admin/listings/:id/approve — you saw the money arrive. */
router.post('/listings/:id/approve', (req, res) => {
  const row = db.prepare('SELECT id, status FROM listings WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not_found' });
  if (row.status !== 'awaiting_approval' && row.status !== 'pending_payment') {
    return res.status(409).json({ error: 'wrong_status', status: row.status });
  }

  const now = new Date().toISOString();
  db.prepare(
    "UPDATE listings SET status = 'published', reviewed_at = ?, published_at = ?, reject_reason = NULL WHERE id = ?"
  ).run(now, now, row.id);

  const to = sellerEmailFor(row.id);
  if (to) emailUser(to.email, 'listing_approved', { listingId: row.id, titleEn: to.title_en, titleVi: to.title_vi });

  res.json({ id: row.id, status: 'published' });
});

/** POST /api/admin/listings/:id/reject — the reason is shown to the seller. */
router.post('/listings/:id/reject', (req, res) => {
  const reason = String(req.body?.reason ?? '').trim();
  if (reason.length < 3 || reason.length > 500) {
    return res.status(400).json({ error: 'reason_required' });
  }

  const row = db.prepare('SELECT id, status FROM listings WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not_found' });
  if (row.status !== 'awaiting_approval' && row.status !== 'pending_payment') {
    return res.status(409).json({ error: 'wrong_status', status: row.status });
  }

  db.prepare("UPDATE listings SET status = 'rejected', reject_reason = ?, reviewed_at = ? WHERE id = ?")
    .run(reason, new Date().toISOString(), row.id);

  const to = sellerEmailFor(row.id);
  if (to) emailUser(to.email, 'listing_rejected', { listingId: row.id, titleEn: to.title_en, titleVi: to.title_vi, reason });

  res.json({ id: row.id, status: 'rejected', reject_reason: reason });
});

/**
 * DELETE /api/admin/listings/:id — the owner takes a listing down. Same as a
 * seller deleting it: hidden everywhere, but the row is kept so chats stay
 * intact and the seller's listing count (and free first listing) is unchanged.
 */
router.delete('/listings/:id', (req, res) => {
  const row = db.prepare('SELECT id, status FROM listings WHERE id = ?').get(req.params.id);
  if (!row || row.status === 'removed') return res.status(404).json({ error: 'not_found' });
  db.prepare("UPDATE listings SET status = 'removed' WHERE id = ?").run(row.id);
  // Taking it down settles any reports about it.
  db.prepare('UPDATE listing_reports SET resolved_at = ? WHERE listing_id = ? AND resolved_at IS NULL').run(new Date().toISOString(), row.id);
  res.json({ id: row.id, status: 'removed' });
});

/** GET/PUT /api/admin/settings — bank details and the listing fee. */
router.get('/settings', (req, res) => {
  res.json({
    settings: getSettings(), banks: BANKS, default_password: usingDefaultPassword(),
    backup: { email: backupEmail() ? backupEmail().replace(/^(.).*(@.*)$/, '$1…$2') : null, mail_enabled: mailEnabled(), last_sent: lastEmailedBackup() },
    ntfy: { configured: notifyConfigured(), token: Boolean(process.env.NTFY_TOKEN?.trim()), last: lastNotify() },
  });
});

/** GET /api/admin/backup — download a gzipped copy of the whole database. */
router.get('/backup', async (req, res, next) => {
  try {
    const gz = await snapshot();
    res.set({
      'Content-Type': 'application/gzip',
      'Content-Disposition': `attachment; filename="${backupFilename()}"`,
      'Cache-Control': 'no-store',
    });
    res.send(gz);
  } catch (err) {
    next(err);
  }
});

/** POST /api/admin/backup/email — email a backup now (to check the setup works). */
router.post('/backup/email', async (req, res) => {
  const outcome = await emailBackup();
  res.status(outcome === 'sent' ? 200 : outcome === 'off' ? 409 : 502).json({ outcome, last_sent: lastEmailedBackup() });
});

router.put('/settings', (req, res) => {
  const patch = {};
  const body = req.body ?? {};

  if (body.bank_bin !== undefined) {
    const bank = findBank(body.bank_bin);
    if (!bank) return res.status(400).json({ error: 'unknown_bank' });
    patch.bank_bin = bank.bin;
    patch.bank_name = bank.name;
  }
  if (body.account_number !== undefined) {
    const account = String(body.account_number).trim();
    if (!/^[A-Za-z0-9]{4,19}$/.test(account)) return res.status(400).json({ error: 'bad_account_number' });
    patch.account_number = account;
  }
  if (body.account_holder !== undefined) {
    const holder = String(body.account_holder).trim();
    if (holder.length < 2 || holder.length > 60) return res.status(400).json({ error: 'bad_account_holder' });
    patch.account_holder = holder;
  }
  if (body.free_emails !== undefined) {
    const emails = [...new Set(String(body.free_emails).split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))];
    if (emails.length > 50 || emails.some((e) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))) return res.status(400).json({ error: 'bad_free_emails' });
    patch.free_emails = emails.join(', ');
  }
  if (body.stats_exclude_emails !== undefined) {
    const emails = [...new Set(String(body.stats_exclude_emails).split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))];
    if (emails.length > 50 || emails.some((e) => !/^[^@\s',;]+@[^@\s',;]+\.[^@\s',;]+$/.test(e))) return res.status(400).json({ error: 'bad_stats_emails' });
    patch.stats_exclude_emails = emails.join(', ');
  }
  // The listing fee is set by LISTING_FEE_VND on the host, not here.

  res.json({ settings: saveSettings(patch) });
});

/** POST /api/admin/ntfy-test — send a test alert now and report what ntfy answered. */
router.post('/ntfy-test', async (req, res) => {
  const result = await notifyOwner({ title: 'Vòng test alert', message: 'If you can read this, phone alerts work.', tags: ['white_check_mark'] });
  res.json({ configured: notifyConfigured(), ...result });
});

/** GET /api/admin/promo-codes — every code with how often it has been used. */
router.get('/promo-codes', (req, res) => {
  res.json({ codes: db.prepare('SELECT code, note, max_uses, uses, expires_at, active, created_at FROM promo_codes ORDER BY created_at DESC').all() });
});

/** POST /api/admin/promo-codes — create a code. Codes are stored in capitals and matched without regard to case. */
router.post('/promo-codes', (req, res) => {
  const code = String(req.body?.code ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,40}$/.test(code)) return res.status(400).json({ error: 'bad_code' });
  const maxUses = req.body?.max_uses === '' || req.body?.max_uses == null ? null : Number(req.body.max_uses);
  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 100000)) return res.status(400).json({ error: 'bad_max_uses' });
  const expires = req.body?.expires_at ? new Date(`${req.body.expires_at}T23:59:59+07:00`) : null;
  if (expires && Number.isNaN(expires.getTime())) return res.status(400).json({ error: 'bad_expiry' });
  if (db.prepare('SELECT 1 FROM promo_codes WHERE code = ?').get(code)) return res.status(409).json({ error: 'exists' });
  db.prepare('INSERT INTO promo_codes (code, note, max_uses, expires_at, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(code, String(req.body?.note ?? '').trim().slice(0, 120) || null, maxUses, expires ? expires.toISOString() : null, new Date().toISOString());
  res.status(201).json({ ok: true, code });
});

/** PATCH /api/admin/promo-codes/:code — switch a code on or off. */
router.patch('/promo-codes/:code', (req, res) => {
  const result = db.prepare('UPDATE promo_codes SET active = ? WHERE code = ?').run(req.body?.active ? 1 : 0, String(req.params.code).toUpperCase());
  if (!result.changes) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

/** GET /api/admin/messages — contact form submissions, newest first. */
router.get('/messages', (req, res) => {
  res.json({ messages: db.prepare('SELECT * FROM messages ORDER BY created_at DESC LIMIT 100').all(), mail: mailEnabled() });
});

/**
 * POST /api/admin/messages/:id/reply { body } — emails the sender from MAIL_FROM
 * (hello@usevong.com). Their answer goes to the shared inbox, which also gets a copy.
 */
router.post('/messages/:id/reply', async (req, res) => {
  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(Number(req.params.id));
  if (!message) return res.status(404).json({ error: 'not_found' });
  const body = String(req.body?.body ?? '').trim();
  if (body.length < 2 || body.length > 5000) return res.status(400).json({ error: 'bad_body' });
  if (!mailEnabled()) return res.status(503).json({ error: 'mail_off' });

  const email = buildContactReply({ name: message.name, originalBody: message.body, originalAt: message.created_at, replyBody: body });
  const sent = await sendMail({ to: message.email, ...email, replyTo: inboxAddress(), bcc: inboxAddress() });
  if (!sent) return res.status(502).json({ error: 'send_failed' });

  const repliedAt = new Date().toISOString();
  db.prepare('UPDATE messages SET reply_body = ?, replied_at = ? WHERE id = ?').run(body, repliedAt, message.id);
  res.json({ ok: true, replied_at: repliedAt });
});

/**
 * POST /api/admin/listings/:id/email { subject?, body } — write to the seller
 * from the site's address (hello@…). Replies and a copy go to the inbox.
 */
router.post('/listings/:id/email', async (req, res) => {
  const listing = db.prepare('SELECT id, title_en, title_vi FROM listings WHERE id = ? AND is_seed = 0').get(req.params.id);
  if (!listing) return res.status(404).json({ error: 'not_found' });
  const body = String(req.body?.body ?? '').trim();
  const subject = String(req.body?.subject ?? '').trim();
  if (body.length < 2 || body.length > 5000) return res.status(400).json({ error: 'bad_body' });
  if (subject.length > 150) return res.status(400).json({ error: 'bad_subject' });
  if (!mailEnabled()) return res.status(503).json({ error: 'mail_off' });
  const to = sellerEmailFor(listing.id)?.email;
  if (!to) return res.status(409).json({ error: 'no_email' });

  const site = (process.env.PUBLIC_URL || 'https://usevong.com').replace(/\/+$/, '');
  const email = buildSellerNote({ title: listing.title_vi || listing.title_en, url: `${site}/listing/${listing.id}`, body, subject });
  const sent = await sendMail({ to, ...email, replyTo: inboxAddress(), bcc: inboxAddress() });
  if (!sent) return res.status(502).json({ error: 'send_failed' });
  res.json({ ok: true, to });
});

/** GET /api/admin/reports — open reports, newest first, with the listing they are about. */
router.get('/reports', (req, res) => {
  const reports = db.prepare(`
    SELECT r.id, r.listing_id, r.reason, r.details, r.created_at,
           l.ref, l.title_en, l.title_vi, l.status, l.seller_name
    FROM listing_reports r JOIN listings l ON l.id = r.listing_id
    WHERE r.resolved_at IS NULL
    ORDER BY r.created_at DESC LIMIT 200
  `).all();
  res.json({ reports });
});

/** POST /api/admin/reports/:id/dismiss — the listing is fine; close the report. */
router.post('/reports/:id/dismiss', (req, res) => {
  const result = db.prepare('UPDATE listing_reports SET resolved_at = ? WHERE id = ? AND resolved_at IS NULL')
    .run(new Date().toISOString(), Number(req.params.id));
  if (result.changes === 0) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

/** POST /api/admin/sellers/:id/trust { trusted } — give or take away the "trusted seller" badge. */
router.post('/sellers/:id/trust', (req, res) => {
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'not_found' });
  const trustedAt = req.body?.trusted ? new Date().toISOString() : null;
  db.prepare('UPDATE users SET trusted_at = ? WHERE id = ?').run(trustedAt, user.id);
  res.json({ id: user.id, trusted: Boolean(trustedAt) });
});

/** GET /api/admin/reviews — reviews of Vòng (waiting ones first) and the latest seller reviews. */
router.get('/reviews', (req, res) => {
  const site = db.prepare(`
    SELECT r.id, r.rating, r.body, r.status, r.created_at, u.name AS reviewer, u.email AS reviewer_email
    FROM site_reviews r JOIN users u ON u.id = r.user_id
    ORDER BY (r.status = 'pending') DESC, r.created_at DESC LIMIT 200
  `).all();
  const seller = db.prepare(`
    SELECT r.id, r.rating, r.body, r.created_at, r.seller_id, u.name AS reviewer, l.title_en, l.title_vi,
           (SELECT seller_name FROM listings WHERE listings.id = r.listing_id) AS seller_name
    FROM seller_reviews r JOIN users u ON u.id = r.reviewer_id JOIN listings l ON l.id = r.listing_id
    ORDER BY r.created_at DESC LIMIT 200
  `).all();
  res.json({ site, seller, pending: site.filter((r) => r.status === 'pending').length });
});

/** POST /api/admin/site-reviews/:id/(approve|hide) — show a review of Vòng on the home page, or hide it. */
router.post('/site-reviews/:id/:action(approve|hide)', (req, res) => {
  const status = req.params.action === 'approve' ? 'approved' : 'hidden';
  const result = db.prepare('UPDATE site_reviews SET status = ?, reviewed_at = ? WHERE id = ?')
    .run(status, new Date().toISOString(), Number(req.params.id));
  if (result.changes === 0) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true, status });
});

/** DELETE /api/admin/seller-reviews/:id — remove a seller review (fake, abusive or off-topic). */
router.delete('/seller-reviews/:id', (req, res) => {
  const result = db.prepare('DELETE FROM seller_reviews WHERE id = ?').run(Number(req.params.id));
  if (result.changes === 0) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});
