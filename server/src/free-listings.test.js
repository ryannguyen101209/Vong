import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vong-free-listings-'));
process.env.DATABASE_FILE = path.join(directory, 'test.db');
process.env.UPLOADS_DIR = path.join(directory, 'uploads');
process.env.GOOGLE_CLIENT_ID = 'test-client';
process.env.ADMIN_PASSWORD = 'test-admin-pass';
process.env.ANALYTICS_KEY = 'free-listings-analytics-key';
delete process.env.LISTING_FEE_VND;
delete process.env.RESEND_API_KEY;
delete process.env.NTFY_TOPIC;
const { createAuthRouter, sessionUser, protectWrites } = await import('./accounts.js');
const { db, getSettings, listingFee, saveSettings } = await import('./db.js');
const { router: listings } = await import('./routes/listings.js');
const { router: admin } = await import('./routes/admin.js');
const { router: analytics } = await import('./routes/analytics.js');
const app = express();
app.use(express.json(), protectWrites, sessionUser);
app.use('/api/auth', createAuthRouter(async (credential) => ({ sub: credential, email: `${credential}@example.test`, name: credential, email_verified: true })));
app.use('/api/listings', listings);
app.use('/api/admin', admin);
app.use('/api/analytics', analytics);
const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;

async function request(url, { cookie, token, body, method = body ? 'POST' : 'GET' } = {}) {
  const r = await fetch(base + url, { method, headers: { 'X-Vong-Request': '1', ...(cookie ? { Cookie: cookie } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json(), cookie: r.headers.get('set-cookie') };
}

try {
  const token = (await request('/api/admin/login', { body: { password: 'test-admin-pass' } })).body.token;
  const seller = (await request('/api/auth/google', { body: { credential: 'seller' } })).cookie;
  const listing = { description: 'A listing used to check that listing on Vòng is free for everyone.', category: 'furniture', price_vnd: 90000, district: 'district_1', condition: 'good', seller_name: 'Seller', seller_phone: '0900000000' };
  const post = async (title) => (await request('/api/listings', { cookie: seller, body: { ...listing, title } })).body;

  // History: four listings paid at 10.000đ and approved in October 2026 (40.000đ that month).
  const oldRow = db.prepare(`INSERT INTO listings (id, ref, title_vi, description_vi, category, price_vnd, district, condition,
    seller_name, seller_phone, status, fee_vnd, created_at, paid_marked_at, payment_verified_at, reviewed_at, published_at)
    VALUES (?, ?, 'Món cũ đã trả phí', 'Tin đăng từ trước, khi còn thu phí đăng tin.', 'furniture', 100000, 'district_3', 'good',
    'Old seller', '0900000001', 'published', 10000, ?, ?, ?, ?, ?)`);
  for (let i = 1; i <= 4; i += 1) {
    const at = `2026-10-0${i}T03:00:00.000Z`;
    oldRow.run(`old-${i}`, `VONG-OLD00${i}`, at, at, at, at, at);
  }
  const reportFrom = async () => (await request('/api/admin/analytics', { token })).body;
  const getMonth = (month, report) => report.monthly.find((m) => m.month === month);
  const before = await reportFrom();
  assert.equal(getMonth('2026-10', before).fees_vnd, 40000, 'October revenue starts at 40.000đ');
  assert.equal(getMonth('2026-10', before).free_listings, 0);

  // (a) The fee is 0 by default, and the first listing costs nothing.
  assert.equal(listingFee(), 0);
  assert.equal(getSettings().fee_vnd, 0);
  const first = await post('Free first');
  assert.equal(first.fee_vnd, 0);
  assert.equal(first.free, true);

  // (b) The second and later listings cost nothing either.
  const second = await post('Free second');
  const third = await post('Free third');
  assert.equal(second.fee_vnd, 0);
  assert.equal(third.fee_vnd, 0);

  // (c) No payment step: straight to the approval queue, no QR or bank details.
  for (const created of [first, second, third]) {
    assert.equal(created.status, 'awaiting_approval');
    assert.equal((await request(`/api/listings/${created.id}/payment`, { cookie: seller })).body.payment, null);
  }
  const queue = (await request('/api/admin/listings?status=queue', { token })).body.listings.map((l) => l.id);
  assert.ok([first.id, second.id, third.id].every((id) => queue.includes(id)), 'all three wait for approval');
  // Approval is still manual and still works.
  assert.equal((await request(`/api/admin/listings/${first.id}/approve`, { token, method: 'POST' })).status, 200);
  assert.equal((await request(`/api/admin/listings/${second.id}/approve`, { token, method: 'POST' })).status, 200);

  // (d) Historical paid listings keep their stored fee.
  const oldFees = db.prepare("SELECT fee_vnd FROM listings WHERE id LIKE 'old-%'").all().map((r) => r.fee_vnd);
  assert.deepEqual(oldFees, [10000, 10000, 10000, 10000]);

  // (e) Revenue for past months is unchanged; new listings add 0 and count as free.
  const after = await reportFrom();
  assert.equal(getMonth('2026-10', after).fees_vnd, 40000, 'October still adds up to 40.000đ');
  const thisMonth = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7);
  const current = getMonth(thisMonth, after);
  if (thisMonth === '2026-10') {
    assert.equal(current.free_listings, 2, 'the two approved free listings are counted as free');
  } else {
    assert.equal(current.fees_vnd, 0);
    assert.equal(current.free_listings, 2);
  }
  // The key-based analytics route reports the same numbers.
  const keyed = (await request('/api/analytics?key=free-listings-analytics-key')).body;
  assert.equal(getMonth('2026-10', keyed).fees_vnd, 40000);
  assert.equal(keyed.fees_vnd.collected, after.fees_vnd.collected);
  assert.equal(after.fees_vnd.collected, 40000, 'all-time fees collected stay at 40.000đ');

  // The old admin fee setting and the always-free emails no longer change the price.
  saveSettings({ fee_vnd: 25000, free_emails: 'seller@example.test' });
  assert.equal(getSettings().fee_vnd, 0);
  assert.equal((await post('Still free')).fee_vnd, 0);

  // (f) Setting the fee back to 10000 restores it for every listing, first or not.
  process.env.LISTING_FEE_VND = '10000';
  const newcomer = (await request('/api/auth/google', { body: { credential: 'newcomer' } })).cookie;
  const paidFirst = (await request('/api/listings', { cookie: newcomer, body: { ...listing, title: 'Paid first' } })).body;
  assert.equal(paidFirst.fee_vnd, 10000);
  assert.equal(paidFirst.status, 'pending_payment');
  assert.equal((await request(`/api/listings/${paidFirst.id}/payment`, { cookie: newcomer })).body.payment.amount_vnd, 10000);
  assert.equal((await post('Paid again')).fee_vnd, 10000, 'even for a seller who listed for free before');
  delete process.env.LISTING_FEE_VND;
  assert.equal((await post('Free again')).fee_vnd, 0);

  console.log('free listing tests passed');
} finally {
  server.close();
  fs.rmSync(directory, { recursive: true, force: true });
}
