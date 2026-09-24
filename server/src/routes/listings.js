import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { db, getSettings, UPLOADS_DIR } from '../db.js';
import { newId, newRef } from '../ids.js';
import { buildVietQrPayload, findBank } from '../vietqr.js';
import { CATEGORIES, DISTRICTS, CONDITIONS } from '../seed-data.js';
import { requireUser } from '../accounts.js';

export const router = express.Router();

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const upload = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) {
      const dir = path.join(UPLOADS_DIR, 'listings');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename(req, file, cb) {
      const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' }[file.mimetype];
      cb(null, `${newId()}${ext}`);
    },
  }),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter(req, file, cb) {
    cb(null, ALLOWED_IMAGE_TYPES.includes(file.mimetype));
  },
});

/** Columns safe to send to anybody. Seller phone is deliberately not here. */
const PUBLIC_COLUMNS = `
  id, ref, title_en, title_vi, description_en, description_vi, category,
  price_vnd, district, condition, seller_name, image_path, status,
  reject_reason, fee_vnd, views, created_at, published_at, seller_id
`;

const SORTS = {
  newest: 'COALESCE(published_at, created_at) DESC',
  price_asc: 'price_vnd ASC',
  price_desc: 'price_vnd DESC',
};

/** GET /api/listings — published listings, with search / category / sort. */
router.get('/', (req, res) => {
  const { search = '', category = '', sort = 'newest', ids = '' } = req.query;

  const where = [];
  const params = {};

  if (ids) {
    // Used by the Saved page, which keeps its list of ids in the browser.
    const wanted = String(ids).split(',').map((s) => s.trim()).filter(Boolean).slice(0, 200);
    if (wanted.length === 0) return res.json({ listings: [] });
    where.push(`id IN (${wanted.map((_, i) => `@id${i}`).join(',')})`);
    wanted.forEach((id, i) => { params[`id${i}`] = id; });
  }

  where.push("status = 'published'");
  where.push('is_seed = 0');

  if (category && CATEGORIES.includes(String(category))) {
    where.push('category = @category');
    params.category = category;
  }

  if (search) {
    // Matches either language, plus the district name as people type it.
    params.q = `%${String(search).trim().toLowerCase()}%`;
    where.push(`(
      LOWER(COALESCE(title_en, '')) LIKE @q OR LOWER(COALESCE(title_vi, '')) LIKE @q OR
      LOWER(COALESCE(description_en, '')) LIKE @q OR LOWER(COALESCE(description_vi, '')) LIKE @q OR
      LOWER(REPLACE(district, '_', ' ')) LIKE @q
    )`);
  }

  const order = SORTS[String(sort)] ?? SORTS.newest;
  const rows = db
    .prepare(`SELECT ${PUBLIC_COLUMNS} FROM listings WHERE ${where.join(' AND ')} ORDER BY ${order}`)
    .all(params);

  res.json({ listings: rows });
});

/** GET /api/listings/:id — one listing. Views only count published views. */
router.get('/:id', (req, res) => {
  const row = db.prepare(`SELECT ${PUBLIC_COLUMNS} FROM listings WHERE id = ? AND is_seed = 0`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not_found' });
  if (row.status !== 'published' && row.seller_id !== req.user?.id) return res.status(404).json({ error: 'not_found' });

  if (row.status === 'published' && req.query.count !== '0') {
    db.prepare('UPDATE listings SET views = views + 1 WHERE id = ?').run(row.id);
    row.views += 1;
  }
  res.json({ listing: row });
});

function validateListing(body) {
  const errors = {};
  const title = String(body.title ?? '').trim();
  const description = String(body.description ?? '').trim();
  const sellerName = String(body.seller_name ?? '').trim();
  const sellerPhone = String(body.seller_phone ?? '').trim();
  const sellerEmail = String(body.seller_email ?? '').trim();
  const price = Number(String(body.price_vnd ?? '').replace(/[^\d]/g, ''));

  if (title.length < 4 || title.length > 120) errors.title = 'length';
  if (description.length < 20 || description.length > 6000) errors.description = 'length';
  if (!CATEGORIES.includes(String(body.category))) errors.category = 'invalid';
  if (!DISTRICTS.includes(String(body.district))) errors.district = 'invalid';
  if (!CONDITIONS.includes(String(body.condition))) errors.condition = 'invalid';
  if (!Number.isFinite(price) || price < 1000 || price > 2_000_000_000) errors.price_vnd = 'invalid';
  if (sellerName.length < 2 || sellerName.length > 80) errors.seller_name = 'length';
  if (!/^[\d\s+().-]{8,20}$/.test(sellerPhone)) errors.seller_phone = 'invalid';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(sellerEmail) || sellerEmail.length > 120) {
    errors.seller_email = 'invalid';
  }

  return { errors, values: { title, description, sellerName, sellerPhone, sellerEmail, price } };
}

/** POST /api/listings — creates a listing in pending_payment. Nothing is public yet. */
router.post('/', requireUser, upload.single('image'), (req, res) => {
  const { errors, values } = validateListing({ ...req.body, seller_email: req.user.email });
  if (Object.keys(errors).length > 0) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'validation_failed', fields: errors });
  }

  const { fee_vnd: fee } = getSettings();
  const id = newId();
  const ref = newRef();
  const imagePath = req.file ? `/uploads/listings/${req.file.filename}` : null;
  // Sellers write in one language; the other variant stays empty and the UI
  // falls back to what they wrote rather than inventing a translation.
  const lang = req.body.lang === 'vi' ? 'vi' : 'en';

  db.prepare(`
    INSERT INTO listings (
      id, ref, title_en, title_vi, description_en, description_vi, category,
      price_vnd, district, condition, seller_name, seller_phone, seller_email,
      image_path, status, fee_vnd, created_at, seller_id
    ) VALUES (
      @id, @ref, @title_en, @title_vi, @description_en, @description_vi, @category,
      @price_vnd, @district, @condition, @seller_name, @seller_phone, @seller_email,
      @image_path, 'pending_payment', @fee_vnd, @created_at, @seller_id
    )
  `).run({
    id,
    ref,
    title_en: lang === 'en' ? values.title : null,
    title_vi: lang === 'vi' ? values.title : null,
    description_en: lang === 'en' ? values.description : null,
    description_vi: lang === 'vi' ? values.description : null,
    category: req.body.category,
    price_vnd: values.price,
    district: req.body.district,
    condition: req.body.condition,
    seller_name: values.sellerName,
    seller_phone: values.sellerPhone,
    seller_email: values.sellerEmail,
    image_path: imagePath,
    fee_vnd: fee,
    created_at: new Date().toISOString(),
    seller_id: req.user.id,
  });

  res.status(201).json({ id, ref, status: 'pending_payment', fee_vnd: fee });
});

/** GET /api/listings/:id/payment — the VietQR payload for this listing's fee. */
router.get('/:id/payment', requireUser, (req, res) => {
  const row = db
    .prepare('SELECT id, ref, status, fee_vnd, title_en, title_vi, reject_reason FROM listings WHERE id = ? AND seller_id = ? AND is_seed = 0')
    .get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'not_found' });

  const settings = getSettings();
  const bank = findBank(settings.bank_bin);

  let payload;
  try {
    payload = buildVietQrPayload({
      bankBin: settings.bank_bin,
      accountNumber: settings.account_number,
      amount: row.fee_vnd,
      note: row.ref,
    });
  } catch (err) {
    // Bad bank details are an admin misconfiguration, not the seller's fault.
    return res.status(503).json({ error: 'payment_not_configured', detail: err.message });
  }

  res.json({
    listing: {
      id: row.id,
      ref: row.ref,
      status: row.status,
      title_en: row.title_en,
      title_vi: row.title_vi,
      reject_reason: row.reject_reason,
    },
    payment: {
      qr_payload: payload,
      amount_vnd: row.fee_vnd,
      reference: row.ref,
      bank_bin: settings.bank_bin,
      bank_name: bank ? bank.name : settings.bank_name,
      account_number: settings.account_number,
      account_holder: settings.account_holder,
    },
  });
});

/**
 * POST /api/listings/:id/mark-paid — the seller says they sent the transfer.
 * This claim is not verified anywhere: a human checks the bank app and approves.
 */
router.post('/:id/mark-paid', requireUser, (req, res) => {
  const row = db.prepare('SELECT id, status FROM listings WHERE id = ? AND seller_id = ? AND is_seed = 0').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'not_found' });
  if (row.status !== 'pending_payment' && row.status !== 'rejected') {
    return res.status(409).json({ error: 'wrong_status', status: row.status });
  }

  db.prepare(
    "UPDATE listings SET status = 'awaiting_approval', paid_marked_at = ?, reject_reason = NULL WHERE id = ?"
  ).run(new Date().toISOString(), row.id);

  res.json({ id: row.id, status: 'awaiting_approval' });
});

/**
 * POST /api/listings/:id/buy-request — reveals the seller's phone/Zalo and logs
 * the interest. Vong does not carry messages or money between the two people.
 */
router.post('/:id/buy-request', requireUser, (req, res) => {
  const row = db
    .prepare("SELECT id, seller_name, seller_phone FROM listings WHERE id = ? AND status = 'published' AND is_seed = 0")
    .get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not_found' });

  db.prepare('INSERT INTO buy_requests (listing_id, created_at) VALUES (?, ?)')
    .run(row.id, new Date().toISOString());

  res.json({ seller_name: row.seller_name, seller_phone: row.seller_phone });
});
