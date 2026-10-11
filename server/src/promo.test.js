import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vong-promo-'));
process.env.DATABASE_FILE = path.join(directory, 'test.db');
process.env.UPLOADS_DIR = path.join(directory, 'uploads');
process.env.GOOGLE_CLIENT_ID = 'test-client';
process.env.ADMIN_PASSWORD = 'test-admin-pass';
delete process.env.RESEND_API_KEY;
const { createAuthRouter, sessionUser, protectWrites } = await import('./accounts.js');
const { router: listings } = await import('./routes/listings.js');
const { router: admin } = await import('./routes/admin.js');
const app = express();
app.use(express.json(), protectWrites, sessionUser);
app.use('/api/auth', createAuthRouter(async (credential) => ({ sub: credential, email: `${credential}@example.test`, name: credential, email_verified: true })));
app.use('/api/listings', listings);
app.use('/api/admin', admin);
const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;

async function request(url, { cookie, token, body, method = body ? 'POST' : 'GET' } = {}) {
  const response = await fetch(base + url, { method, headers: { 'X-Vong-Request': '1', ...(cookie ? { Cookie: cookie } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie') };
}

try {
  const seller = await request('/api/auth/google', { body: { credential: 'seller' } });
  const other = await request('/api/auth/google', { body: { credential: 'other' } });
  const token = (await request('/api/admin/login', { body: { password: 'test-admin-pass' } })).body.token;
  const listing = { title: 'Promo test lamp', description: 'A test listing used to check the promo code flow.', category: 'furniture', price_vnd: 90000, district: 'district_1', condition: 'good', seller_name: 'Seller', seller_phone: '0900000000' };
  const make = async (cookie, title) => (await request('/api/listings', { cookie, body: { ...listing, title } })).body;

  // The first listing is free already, so codes are for the second one onwards.
  const first = await make(seller.cookie, 'Promo test first');
  assert.equal(first.free, true);
  const second = await make(seller.cookie, 'Promo test second');
  assert.equal(second.status, 'pending_payment');
  assert.ok(second.fee_vnd > 0);

  // Only the owner can manage codes.
  assert.equal((await request('/api/admin/promo-codes', { cookie: seller.cookie })).status, 401);
  assert.equal((await request('/api/admin/promo-codes', { cookie: seller.cookie, body: { code: 'NOPE' } })).status, 401);

  // Creating codes: letters, digits, dash, underscore; stored in capitals; no duplicates.
  assert.equal((await request('/api/admin/promo-codes', { token, body: { code: 'a b' } })).status, 400);
  assert.equal((await request('/api/admin/promo-codes', { token, body: { code: 'ownersfriend101', note: 'friend' } })).status, 201);
  assert.equal((await request('/api/admin/promo-codes', { token, body: { code: 'OWNERSFRIEND101' } })).status, 409);
  assert.equal((await request('/api/admin/promo-codes', { token, body: { code: 'ONEUSE', max_uses: 1 } })).status, 201);
  assert.equal((await request('/api/admin/promo-codes', { token, body: { code: 'OLD', expires_at: '2020-01-01' } })).status, 201);
  assert.equal((await request('/api/admin/promo-codes', { token, body: { code: 'OFFCODE' } })).status, 201);
  assert.equal((await request('/api/admin/promo-codes/OFFCODE', { token, method: 'PATCH', body: { active: false } })).status, 200);

  // Bad codes all look the same to the seller.
  for (const code of ['', 'NOSUCH', 'OLD', 'OFFCODE']) {
    const r = await request(`/api/listings/${second.id}/promo`, { cookie: seller.cookie, body: { code } });
    assert.equal(r.status, 400, `code "${code}" is refused`);
    assert.equal(r.body.error, 'invalid_code');
  }
  assert.equal((await request(`/api/listings/${second.id}/promo`, { body: { code: 'ONEUSE' } })).status, 401, 'signed in only');
  assert.equal((await request(`/api/listings/${second.id}/promo`, { cookie: other.cookie, body: { code: 'ONEUSE' } })).status, 404, 'only the listing owner');

  // A good code, in any case, makes the listing free and sends it to review.
  const ok = await request(`/api/listings/${second.id}/promo`, { cookie: seller.cookie, body: { code: ' ownersfriend101 ' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.free, true);
  const pay = (await request(`/api/listings/${second.id}/payment`, { cookie: seller.cookie })).body;
  assert.equal(pay.listing.free, true);
  assert.equal(pay.listing.status, 'awaiting_approval');
  assert.equal(pay.payment, null);

  // Once it is free there is nothing left to apply a code to.
  assert.equal((await request(`/api/listings/${second.id}/promo`, { cookie: seller.cookie, body: { code: 'ONEUSE' } })).status, 409);

  // One use per account, and a code with a use limit runs out.
  const third = await make(seller.cookie, 'Promo test third');
  const again = await request(`/api/listings/${third.id}/promo`, { cookie: seller.cookie, body: { code: 'OWNERSFRIEND101' } });
  assert.equal(again.status, 409);
  assert.equal(again.body.error, 'already_used');
  assert.equal((await request(`/api/listings/${third.id}/promo`, { cookie: seller.cookie, body: { code: 'ONEUSE' } })).status, 200);
  await make(other.cookie, 'Promo other first');
  const otherSecond = await make(other.cookie, 'Promo other second');
  assert.equal((await request(`/api/listings/${otherSecond.id}/promo`, { cookie: other.cookie, body: { code: 'ONEUSE' } })).status, 400, 'used up');
  assert.equal((await request(`/api/listings/${otherSecond.id}/promo`, { cookie: other.cookie, body: { code: 'OWNERSFRIEND101' } })).status, 200, 'another account can use the same code');

  // The owner sees how often each code was used.
  const codes = Object.fromEntries((await request('/api/admin/promo-codes', { token })).body.codes.map((c) => [c.code, c]));
  assert.equal(codes.OWNERSFRIEND101.uses, 2);
  assert.equal(codes.ONEUSE.uses, 1);
  assert.equal(codes.OFFCODE.active, 0);

  console.log('promo code tests passed');
} finally {
  server.close();
}
