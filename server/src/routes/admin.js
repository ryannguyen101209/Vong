import express from 'express';
import { db, getSettings, saveSettings } from '../db.js';
import { login, logout, requireAdmin, usingDefaultPassword } from '../auth.js';
import { BANKS, findBank } from '../vietqr.js';

export const router = express.Router();

/** POST /api/admin/login — password in, bearer token out. */
router.post('/login', (req, res) => {
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
  district, condition, seller_name, seller_phone, seller_email, image_path, status, reject_reason,
  fee_vnd, views, created_at, paid_marked_at, reviewed_at, published_at
`;

/** GET /api/admin/listings?status=... — the review queue. */
router.get('/listings', (req, res) => {
  const status = String(req.query.status ?? 'awaiting_approval');
  const statuses = ['pending_payment', 'awaiting_approval', 'published', 'rejected'];

  const rows = statuses.includes(status)
    ? db.prepare(`SELECT ${ADMIN_COLUMNS} FROM listings WHERE status = ? ORDER BY COALESCE(paid_marked_at, created_at) ASC`).all(status)
    : db.prepare(`SELECT ${ADMIN_COLUMNS} FROM listings ORDER BY created_at DESC`).all();

  const counts = Object.fromEntries(statuses.map((s) => [s, 0]));
  for (const row of db.prepare('SELECT status, COUNT(*) AS n FROM listings GROUP BY status').all()) {
    counts[row.status] = row.n;
  }

  res.json({ listings: rows, counts });
});

/** POST /api/admin/listings/:id/approve — you saw the money arrive. */
router.post('/listings/:id/approve', (req, res) => {
  const row = db.prepare('SELECT id, status FROM listings WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not_found' });
  if (row.status !== 'awaiting_approval') {
    return res.status(409).json({ error: 'wrong_status', status: row.status });
  }

  const now = new Date().toISOString();
  db.prepare(
    "UPDATE listings SET status = 'published', reviewed_at = ?, published_at = ?, reject_reason = NULL WHERE id = ?"
  ).run(now, now, row.id);

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
  if (row.status !== 'awaiting_approval') {
    return res.status(409).json({ error: 'wrong_status', status: row.status });
  }

  db.prepare("UPDATE listings SET status = 'rejected', reject_reason = ?, reviewed_at = ? WHERE id = ?")
    .run(reason, new Date().toISOString(), row.id);

  res.json({ id: row.id, status: 'rejected', reject_reason: reason });
});

/** GET/PUT /api/admin/settings — bank details and the listing fee. */
router.get('/settings', (req, res) => {
  res.json({ settings: getSettings(), banks: BANKS, default_password: usingDefaultPassword() });
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
  if (body.fee_vnd !== undefined) {
    const fee = Number(String(body.fee_vnd).replace(/[^\d]/g, ''));
    if (!Number.isFinite(fee) || fee < 0 || fee > 10_000_000) return res.status(400).json({ error: 'bad_fee' });
    patch.fee_vnd = fee;
  }

  res.json({ settings: saveSettings(patch) });
});

/** GET /api/admin/messages — contact form submissions, newest first. */
router.get('/messages', (req, res) => {
  res.json({ messages: db.prepare('SELECT * FROM messages ORDER BY created_at DESC LIMIT 100').all() });
});
