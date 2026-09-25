/*
 * The last step before a listing goes live. When an admin approves a listing, a
 * one-time key is generated and emailed to the address the seller gave. The
 * seller types it into the key box on their listing page, which publishes it.
 *
 * Only a hash of the key is stored. A key expires after a week and locks after
 * five wrong attempts; either way a fresh one can be sent.
 */
import crypto from 'node:crypto';
import { db } from './db.js';
import { newPublishKey } from './ids.js';
import { mailConfigured, sendMail } from './mailer.js';

export const KEY_TTL_MS = 1000 * 60 * 60 * 24 * 7;
export const MAX_KEY_ATTEMPTS = 5;
export const RESEND_COOLDOWN_MS = 60 * 1000;

/** Case, spaces and dashes don't matter when someone types the key back. */
export function normalizeKey(value) {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

const hashKey = (value) => crypto.createHash('sha256').update(normalizeKey(value)).digest('hex');

/** The public address to link to in emails. */
export function siteUrl(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  const allowed = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((value) => value.trim());
  const origin = req.get('origin');
  return allowed.includes(origin) ? origin : allowed[0];
}

const listingLang = (listing) => (listing.title_vi && !listing.title_en ? 'vi' : 'en');
const listingTitle = (listing) => listing.title_en || listing.title_vi || '';

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

const TEMPLATES = {
  en: {
    keySubject: (v) => `Your Vòng key for “${v.title}”`,
    keyLines: (v) => [
      `Hi ${v.name},`,
      `We checked your listing fee for “${v.title}” (reference ${v.ref}) and approved it. To put the listing live, enter this key on Vòng:`,
      '{{KEY}}',
      `Enter it here: ${v.url}`,
      'The key works for 7 days. If you did not post this listing, you can ignore this email.',
      'The Vòng team',
    ],
    rejectSubject: (v) => `About your Vòng listing: ${v.title}`,
    rejectLines: (v) => [
      `Hi ${v.name},`,
      `We were not able to publish your listing “${v.title}” yet.`,
      `Reason: ${v.reason}`,
      `Your reference is ${v.ref}. If you have paid since, or think this is a mistake, open your listing and press “I’ve sent the payment” again: ${v.url}`,
      'The Vòng team',
    ],
  },
  vi: {
    keySubject: (v) => `Mã kích hoạt Vòng cho “${v.title}”`,
    keyLines: (v) => [
      `Chào ${v.name},`,
      `Tụi mình đã kiểm tra phí đăng tin “${v.title}” (mã tin ${v.ref}) và duyệt tin của bạn. Để tin được hiển thị, hãy nhập mã sau trên Vòng:`,
      '{{KEY}}',
      `Nhập mã tại: ${v.url}`,
      'Mã có hiệu lực trong 7 ngày. Nếu bạn không đăng tin này, hãy bỏ qua email này.',
      'Đội ngũ Vòng',
    ],
    rejectSubject: (v) => `Về tin đăng Vòng của bạn: ${v.title}`,
    rejectLines: (v) => [
      `Chào ${v.name},`,
      `Tụi mình chưa thể đăng tin “${v.title}” của bạn.`,
      `Lý do: ${v.reason}`,
      `Mã tin của bạn là ${v.ref}. Nếu bạn đã chuyển khoản sau đó hoặc nghĩ rằng có nhầm lẫn, hãy mở tin và bấm “Mình đã chuyển khoản” một lần nữa: ${v.url}`,
      'Đội ngũ Vòng',
    ],
  },
};

function render(lines, key) {
  const text = lines.map((line) => (line === '{{KEY}}' ? `    ${key}` : line)).join('\n\n');
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#25332b;max-width:520px">${lines
    .map((line) =>
      line === '{{KEY}}'
        ? `<p style="font-family:Menlo,Consolas,monospace;font-size:28px;font-weight:700;letter-spacing:4px;padding:16px 20px;background:#eaf0e5;border-radius:8px;display:inline-block;margin:4px 0">${escapeHtml(key)}</p>`
        : `<p style="margin:0 0 14px">${escapeHtml(line)}</p>`)
    .join('')}</div>`;
  return { text, html };
}

function storeKey(listingId, key) {
  db.prepare(`UPDATE listings SET publish_key_hash = ?, publish_key_expires_at = ?, publish_key_attempts = 0,
    publish_key_sent_at = ? WHERE id = ?`).run(hashKey(key), Date.now() + KEY_TTL_MS, new Date().toISOString(), listingId);
}

/**
 * Creates a fresh key for the listing, replacing any earlier one, and tries to
 * email it. For an admin, the key is saved either way and returned when it was
 * not emailed, so they can pass it on by hand. With requireDelivery (a seller
 * asking for a new key), nothing changes unless the email actually went out, so
 * a failed resend never invalidates the key they already have.
 */
export async function issuePublishKey(listing, url, { requireDelivery = false } = {}) {
  const key = newPublishKey();
  const link = `${url}/payment/${listing.id}`;
  if (!requireDelivery) storeKey(listing.id, key);

  if (!mailConfigured()) {
    if (requireDelivery) return { delivery: 'not_configured' };
    if (process.env.NODE_ENV !== 'production') console.log(`[publish key] ${listing.ref}: ${key} (mail is not configured)`);
    return { delivery: 'not_configured', key, sent_to: listing.seller_email, link };
  }
  const lang = listingLang(listing);
  const vars = { name: listing.seller_name, title: listingTitle(listing), ref: listing.ref, url: link };
  try {
    await sendMail({ to: listing.seller_email, subject: TEMPLATES[lang].keySubject(vars), ...render(TEMPLATES[lang].keyLines(vars), key) });
    if (requireDelivery) storeKey(listing.id, key);
    return { delivery: 'sent', sent_to: listing.seller_email };
  } catch (error) {
    console.error(`[publish key] could not email ${listing.ref}:`, error.message);
    if (requireDelivery) return { delivery: 'failed' };
    return { delivery: 'failed', key, sent_to: listing.seller_email, link };
  }
}

/** Best effort: tells the seller why a listing was rejected, if mail is set up. */
export async function sendRejection(listing, reason, url) {
  if (!mailConfigured() || !listing.seller_email) return { delivery: 'not_configured' };
  const lang = listingLang(listing);
  const vars = { name: listing.seller_name, title: listingTitle(listing), ref: listing.ref, reason, url: `${url}/payment/${listing.id}` };
  try {
    await sendMail({ to: listing.seller_email, subject: TEMPLATES[lang].rejectSubject(vars), ...render(TEMPLATES[lang].rejectLines(vars)) });
    return { delivery: 'sent' };
  } catch (error) {
    console.error(`[reject] could not email ${listing.ref}:`, error.message);
    return { delivery: 'failed' };
  }
}

/**
 * Checks a key typed by the seller. Returns 'ok', or the reason it failed:
 * 'no_key', 'key_expired', 'key_locked' or 'wrong_key'.
 */
export function checkPublishKey(listing, input) {
  if (!listing.publish_key_hash) return 'no_key';
  if (listing.publish_key_expires_at <= Date.now()) return 'key_expired';
  if (listing.publish_key_attempts >= MAX_KEY_ATTEMPTS) return 'key_locked';
  const given = Buffer.from(hashKey(input), 'hex');
  const expected = Buffer.from(listing.publish_key_hash, 'hex');
  if (normalizeKey(input).length === 8 && crypto.timingSafeEqual(given, expected)) return 'ok';
  db.prepare('UPDATE listings SET publish_key_attempts = publish_key_attempts + 1 WHERE id = ?').run(listing.id);
  return listing.publish_key_attempts + 1 >= MAX_KEY_ATTEMPTS ? 'key_locked' : 'wrong_key';
}

/** What the seller's page needs to know about their key, never the key itself. */
export function keyStatus(listing) {
  if (listing.status !== 'approved') return null;
  return {
    sent_to: listing.seller_email,
    sent_at: listing.publish_key_sent_at,
    expired: !listing.publish_key_expires_at || listing.publish_key_expires_at <= Date.now(),
    locked: listing.publish_key_attempts >= MAX_KEY_ATTEMPTS,
    attempts_left: Math.max(0, MAX_KEY_ATTEMPTS - listing.publish_key_attempts),
    can_resend: mailConfigured(),
  };
}
