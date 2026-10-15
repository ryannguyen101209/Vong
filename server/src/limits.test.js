// Limits that stop one account harvesting phone numbers or flooding the site,
// and the browser protections sent with every response.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vong-limits-'));
process.env.DATABASE_FILE = path.join(directory, 'test.db');
process.env.UPLOADS_DIR = path.join(directory, 'uploads');
process.env.GOOGLE_CLIENT_ID = 'test-client';
delete process.env.LISTING_FEE_VND;
delete process.env.RESEND_API_KEY;
delete process.env.NTFY_TOPIC;
const { db } = await import('./db.js');
const { createAuthRouter, sessionUser, protectWrites } = await import('./accounts.js');
const { router: listings, PHONE_REVEALS_PER_DAY, LISTINGS_PER_DAY } = await import('./routes/listings.js');
const { securityHeaders, contentSecurityPolicy } = await import('./security-headers.js');

// A built page with one inline script, to check the policy allows exactly that script.
const dist = path.join(directory, 'dist');
fs.mkdirSync(dist);
const inline = "try { document.documentElement.dataset.theme = 'dark'; } catch (e) {}";
fs.writeFileSync(path.join(dist, 'index.html'), `<html><head><script>${inline}</script><script type="module" src="/a.js"></script></head></html>`);

const app = express();
app.use(securityHeaders(dist));
app.use(express.json(), protectWrites, sessionUser);
app.use('/api/auth', createAuthRouter(async (credential) => ({ sub: credential, email: `${credential}@example.test`, name: credential, email_verified: true })));
app.use('/api/listings', listings);
const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;
const request = async (url, { cookie, body, method = body ? 'POST' : 'GET' } = {}) => {
  const r = await fetch(base + url, { method, headers: { 'X-Vong-Request': '1', ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => null), headers: r.headers, cookie: r.headers.get('set-cookie') };
};
const signIn = async (who) => (await request('/api/auth/google', { body: { credential: who } })).cookie;

try {
  // Browser protections on every response.
  const res = await request('/api/listings');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  const csp = res.headers.get('content-security-policy');
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /script-src 'self' https:\/\/accounts\.google\.com\/gsi\/client 'sha256-/);
  const hash = crypto.createHash('sha256').update(inline).digest('base64');
  assert.ok(csp.includes(`'sha256-${hash}'`), 'the theme script is allowed by its hash');
  assert.ok(!/script-src[^;]*unsafe-inline/.test(csp), 'no other inline script may run');
  assert.ok(!contentSecurityPolicy(path.join(directory, 'nope')).includes('sha256-'), 'no build, no hashes');

  // Phone numbers: one account can reveal a limited number per day.
  const buyer = await signIn('buyer');
  const insert = db.prepare(`INSERT INTO listings (id, ref, title_vi, description_vi, category, price_vnd, district, condition,
    seller_name, seller_phone, status, fee_vnd, created_at) VALUES (?, ?, 'Món', 'Mô tả món đồ', 'furniture', 100000, 'hcm_ben_thanh', 'good', 'An', '0900000000', 'published', 0, ?)`);
  for (let i = 0; i <= PHONE_REVEALS_PER_DAY; i += 1) insert.run(`l${i}`, `VONG-L${i}`, new Date().toISOString());
  for (let i = 0; i < PHONE_REVEALS_PER_DAY; i += 1) {
    assert.equal((await request(`/api/listings/l${i}/buy-request`, { cookie: buyer, method: 'POST' })).status, 200);
  }
  const over = await request(`/api/listings/l${PHONE_REVEALS_PER_DAY}/buy-request`, { cookie: buyer, method: 'POST' });
  assert.equal(over.status, 429);
  assert.equal(over.body.error, 'too_many_reveals');
  assert.equal((await request('/api/listings/l0/buy-request', { cookie: buyer, method: 'POST' })).status, 200, 'a number already seen today can be seen again');
  const other = await signIn('other');
  assert.equal((await request(`/api/listings/l${PHONE_REVEALS_PER_DAY}/buy-request`, { cookie: other, method: 'POST' })).status, 200, 'the limit is per account');

  // New listings: a daily cap per account, checked before photos are saved.
  const seller = await signIn('seller');
  const sellerId = db.prepare("SELECT id FROM users WHERE email = 'seller@example.test'").get().id;
  const own = db.prepare(`INSERT INTO listings (id, ref, title_vi, description_vi, category, price_vnd, district, condition,
    seller_name, seller_phone, status, fee_vnd, created_at, seller_id) VALUES (?, ?, 'Món', 'Mô tả món đồ', 'furniture', 100000, 'hcm_ben_thanh', 'good', 'An', '0900000000', 'awaiting_approval', 0, ?, ?)`);
  for (let i = 0; i < LISTINGS_PER_DAY; i += 1) own.run(`s${i}`, `VONG-S${i}`, new Date().toISOString(), sellerId);
  const capped = await request('/api/listings', { cookie: seller, body: { title: 'Ghế gỗ', description: 'Một cái ghế gỗ còn tốt, dùng ít.', category: 'furniture', price_vnd: 100000, district: 'hcm_ben_thanh', condition: 'good', seller_name: 'An', seller_phone: '0900000000' } });
  assert.equal(capped.status, 429);
  assert.equal(capped.body.error, 'too_many_listings');

  console.log('limit and header tests passed');
} finally {
  server.close();
  fs.rmSync(directory, { recursive: true, force: true });
}
