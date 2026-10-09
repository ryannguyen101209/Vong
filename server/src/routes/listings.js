import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { db, getSettings, isFirstListing, UPLOADS_DIR } from '../db.js';
import { newId, newRef } from '../ids.js';
import { buildVietQrPayload, findBank } from '../vietqr.js';
import { CATEGORIES, DISTRICTS, CONDITIONS } from '../seed-data.js';
import { requireUser } from '../accounts.js';
import { notifyOwner } from '../notify.js';
import { rateLimit } from 'express-rate-limit';
import { translateListing, TranslationError } from '../translate.js';

export const router = express.Router();

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_PHOTOS = 8;
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
  limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_PHOTOS },
  fileFilter(req, file, cb) {
    cb(null, ALLOWED_IMAGE_TYPES.includes(file.mimetype));
  },
});

/** Columns safe to send to anybody. Seller phone is deliberately not here. */
const PUBLIC_COLUMNS = `
  id, ref, title_en, title_vi, description_en, description_vi, category,
  price_vnd, district, condition, seller_name, image_path, images, status,
  reject_reason, fee_vnd, views, created_at, published_at, seller_id
`;

/** Turns the stored JSON column into an array, falling back to the single cover photo. */
function withImages(row) {
  if (!row) return row;
  let images = [];
  try { images = JSON.parse(row.images || '[]'); } catch { images = []; }
  if (!Array.isArray(images) || images.length === 0) images = row.image_path ? [row.image_path] : [];
  return { ...row, images };
}

/** Uploaded files from either the new `images` field or the older single `image` field. */
function uploadedFiles(req) {
  return [...(req.files?.images ?? []), ...(req.files?.image ?? [])];
}

const SORTS = {
  newest: 'COALESCE(published_at, created_at) DESC',
  price_asc: 'price_vnd ASC',
  price_desc: 'price_vnd DESC',
};

/** A whole number of dong from a query value, or null when absent or invalid. */
function priceParam(value) {
  if (value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

/** GET /api/listings — published listings, with search / category / district / price / sort. */
router.get('/', (req, res) => {
  const { search = '', category = '', district = '', sort = 'newest', ids = '' } = req.query;

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

  if (district && DISTRICTS.includes(String(district))) {
    where.push('district = @district');
    params.district = district;
  }

  const minPrice = priceParam(req.query.min_price);
  const maxPrice = priceParam(req.query.max_price);
  if (minPrice !== null) { where.push('price_vnd >= @minPrice'); params.minPrice = minPrice; }
  if (maxPrice !== null) { where.push('price_vnd <= @maxPrice'); params.maxPrice = maxPrice; }

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

  res.json({ listings: rows.map(withImages) });
});

/** GET /api/listings/mine — everything the signed-in seller has listed, any status. */
router.get('/mine', requireUser, (req, res) => {
  const rows = db
    .prepare(`
      SELECT ${PUBLIC_COLUMNS}, seller_phone, paid_marked_at, sold_at FROM listings
      WHERE seller_id = ? AND is_seed = 0 AND status != 'removed'
      ORDER BY created_at DESC
    `)
    .all(req.user.id);
  res.set('Cache-Control', 'no-store');
  res.json({ listings: rows.map(withImages) });
});

/** GET /api/listings/:id — one listing. Views only count published views. */
router.get('/:id', (req, res) => {
  const row = db.prepare(`SELECT ${PUBLIC_COLUMNS} FROM listings WHERE id = ? AND is_seed = 0`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not_found' });
  if (row.status === 'removed') return res.status(404).json({ error: 'not_found' });
  // Sold listings stay viewable (marked as sold) so old links do not break.
  const isPublic = row.status === 'published' || row.status === 'sold';
  if (!isPublic && row.seller_id !== req.user?.id) return res.status(404).json({ error: 'not_found' });

  if (row.status === 'published' && req.query.count !== '0') {
    db.prepare('UPDATE listings SET views = views + 1 WHERE id = ?').run(row.id);
    row.views += 1;
  }
  res.json({ listing: withImages(row) });
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
router.post('/', requireUser, upload.fields([{ name: 'images', maxCount: MAX_PHOTOS }, { name: 'image', maxCount: 1 }]), (req, res) => {
  const files = uploadedFiles(req);
  const { errors, values } = validateListing({ ...req.body, seller_email: req.user.email });
  if (files.length > MAX_PHOTOS) errors.images = 'too_many';
  if (Object.keys(errors).length > 0) {
    files.forEach((file) => fs.unlink(file.path, () => {}));
    return res.status(400).json({ error: 'validation_failed', fields: errors });
  }

  // First listing per account is free: no fee, no payment step, straight to the
  // admin queue (it is still reviewed by hand before it goes live).
  const free = isFirstListing(req.user.id);
  const fee = free ? 0 : getSettings().fee_vnd;
  const now = new Date().toISOString();
  const id = newId();
  const ref = newRef();
  const imagePaths = files.map((file) => `/uploads/listings/${file.filename}`);
  // Sellers write in one language; the other variant stays empty and the UI
  // falls back to what they wrote rather than inventing a translation.
  const lang = req.body.lang === 'vi' ? 'vi' : 'en';

  db.prepare(`
    INSERT INTO listings (
      id, ref, title_en, title_vi, description_en, description_vi, category,
      price_vnd, district, condition, seller_name, seller_phone, seller_email,
      image_path, images, status, fee_vnd, created_at, paid_marked_at, seller_id
    ) VALUES (
      @id, @ref, @title_en, @title_vi, @description_en, @description_vi, @category,
      @price_vnd, @district, @condition, @seller_name, @seller_phone, @seller_email,
      @image_path, @images, @status, @fee_vnd, @created_at, @paid_marked_at, @seller_id
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
    image_path: imagePaths[0] ?? null,
    images: JSON.stringify(imagePaths),
    status: free ? 'awaiting_approval' : 'pending_payment',
    fee_vnd: fee,
    created_at: now,
    paid_marked_at: free ? now : null,
    seller_id: req.user.id,
  });

  notifyOwner({
    title: free ? 'New listing to review (free first listing)' : 'New listing, awaiting payment',
    message: `${values.title} · ${values.price} VND` + (free ? '' : ` · fee ${fee} VND`),
    tags: ['bell'],
  });

  res.status(201).json({ id, ref, status: free ? 'awaiting_approval' : 'pending_payment', fee_vnd: fee, free });
});

/** GET /api/listings/:id/payment — the VietQR payload for this listing's fee. */
router.get('/:id/payment', requireUser, (req, res) => {
  const row = db
    .prepare('SELECT id, ref, status, fee_vnd, title_en, title_vi, reject_reason, payment_verified_at FROM listings WHERE id = ? AND seller_id = ? AND is_seed = 0')
    .get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'not_found' });

  const listing = {
    id: row.id,
    ref: row.ref,
    status: row.status,
    free: row.fee_vnd === 0,
    title_en: row.title_en,
    title_vi: row.title_vi,
    reject_reason: row.reject_reason,
    payment_verified: !!row.payment_verified_at,
  };
  // A free first listing has nothing to pay: no QR, no bank details.
  if (listing.free) return res.json({ listing, payment: null });

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
    listing,
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

  notifyOwner({ title: 'Seller says they paid', message: `Listing ${row.id}: check your bank app, then approve.`, tags: ['moneybag'] });

  res.json({ id: row.id, status: 'awaiting_approval' });
});

/** The seller's own, not-removed listing, or undefined. */
function ownListing(req) {
  return db
    .prepare("SELECT * FROM listings WHERE id = ? AND seller_id = ? AND is_seed = 0 AND status != 'removed'")
    .get(req.params.id, req.user.id);
}

/**
 * PATCH /api/listings/:id — the seller edits text fields. Photos and the fee are
 * not touched. A live listing stays live: edits do not go back through review.
 */
router.patch('/:id', requireUser, (req, res) => {
  const row = ownListing(req);
  if (!row) return res.status(404).json({ error: 'not_found' });

  const body = req.body ?? {};
  const lang = row.title_en != null ? 'en' : 'vi';
  const merged = {
    title: body.title ?? row.title_en ?? row.title_vi,
    description: body.description ?? row.description_en ?? row.description_vi,
    category: body.category ?? row.category,
    price_vnd: body.price_vnd ?? row.price_vnd,
    district: body.district ?? row.district,
    condition: body.condition ?? row.condition,
    seller_name: body.seller_name ?? row.seller_name,
    seller_phone: body.seller_phone ?? row.seller_phone,
    seller_email: req.user.email,
  };
  const { errors, values } = validateListing(merged);
  if (Object.keys(errors).length > 0) return res.status(400).json({ error: 'validation_failed', fields: errors });

  db.prepare(`
    UPDATE listings SET
      title_en = @title_en, title_vi = @title_vi,
      description_en = @description_en, description_vi = @description_vi,
      category = @category, price_vnd = @price_vnd, district = @district, condition = @condition,
      seller_name = @seller_name, seller_phone = @seller_phone
    WHERE id = @id
  `).run({
    id: row.id,
    title_en: lang === 'en' ? values.title : row.title_en,
    title_vi: lang === 'vi' ? values.title : row.title_vi,
    description_en: lang === 'en' ? values.description : row.description_en,
    description_vi: lang === 'vi' ? values.description : row.description_vi,
    category: merged.category,
    price_vnd: values.price,
    district: merged.district,
    condition: merged.condition,
    seller_name: values.sellerName,
    seller_phone: values.sellerPhone,
  });
  res.json({ id: row.id });
});

/** POST /api/listings/:id/sold — a live listing is marked sold and leaves Browse. */
router.post('/:id/sold', requireUser, (req, res) => {
  const row = ownListing(req);
  if (!row) return res.status(404).json({ error: 'not_found' });
  if (row.status !== 'published') return res.status(409).json({ error: 'wrong_status', status: row.status });
  db.prepare("UPDATE listings SET status = 'sold', sold_at = ? WHERE id = ?").run(new Date().toISOString(), row.id);
  res.json({ id: row.id, status: 'sold' });
});

/** POST /api/listings/:id/relist — undo "sold" (the buyer fell through). */
router.post('/:id/relist', requireUser, (req, res) => {
  const row = ownListing(req);
  if (!row) return res.status(404).json({ error: 'not_found' });
  if (row.status !== 'sold') return res.status(409).json({ error: 'wrong_status', status: row.status });
  db.prepare("UPDATE listings SET status = 'published', sold_at = NULL WHERE id = ?").run(row.id);
  res.json({ id: row.id, status: 'published' });
});

/**
 * DELETE /api/listings/:id — the seller removes their listing. It is hidden
 * everywhere but the row is kept, so chats and buy requests stay intact and a
 * deleted first listing does not hand out a second free one.
 */
router.delete('/:id', requireUser, (req, res) => {
  const row = ownListing(req);
  if (!row) return res.status(404).json({ error: 'not_found' });
  db.prepare("UPDATE listings SET status = 'removed' WHERE id = ?").run(row.id);
  res.json({ id: row.id, status: 'removed' });
});

/**
 * POST /api/listings/:id/buy-request — reveals the seller's phone/Zalo and logs
 * the interest. Vong does not carry messages or money between the two people.
 */
// Each translation that is not already saved costs a model call, so cap how often one visitor can ask.
const translateLimit = rateLimit({ windowMs: 60 * 60_000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'too_many_translations' } });

/**
 * POST /api/listings/:id/translate { to: 'en' | 'vi' } — the title and description
 * in the other language, machine-translated and saved. Public listings only.
 */
router.post('/:id/translate', translateLimit, async (req, res, next) => {
  const row = db
    .prepare("SELECT id, title_en, title_vi, description_en, description_vi FROM listings WHERE id = ? AND status IN ('published', 'sold')")
    .get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not_found' });
  try {
    const result = await translateListing(row, String(req.body?.to ?? ''));
    res.json({ lang: req.body.to, title: result.title, description: result.description, machine: true });
  } catch (error) {
    if (!(error instanceof TranslationError)) return next(error);
    const status = { bad_language: 400, same_language: 400, disabled: 404, busy: 503, failed: 502 }[error.code] ?? 500;
    res.status(status).json({ error: `translation_${error.code}` });
  }
});

router.post('/:id/buy-request', requireUser, (req, res) => {
  const row = db
    .prepare("SELECT id, seller_name, seller_phone FROM listings WHERE id = ? AND status = 'published' AND is_seed = 0")
    .get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not_found' });

  db.prepare('INSERT INTO buy_requests (listing_id, created_at) VALUES (?, ?)')
    .run(row.id, new Date().toISOString());

  res.json({ seller_name: row.seller_name, seller_phone: row.seller_phone });
});
