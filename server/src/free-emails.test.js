import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vong-free-'));
process.env.DATABASE_FILE = path.join(directory, 'test.db');
process.env.UPLOADS_DIR = path.join(directory, 'uploads');
process.env.GOOGLE_CLIENT_ID = 'test-client';
process.env.ADMIN_PASSWORD = 'test-admin-pass';
delete process.env.RESEND_API_KEY;
delete process.env.NTFY_TOPIC;
const { createAuthRouter, sessionUser, protectWrites } = await import('./accounts.js');
const { router: listings } = await import('./routes/listings.js');
const { router: admin } = await import('./routes/admin.js');
const { hasFreeListings, isFirstListing } = await import('./db.js');
const app = express();
app.use(express.json(), protectWrites, sessionUser);
// The test sign-in uses the credential as the email's local part, e.g. "friend" -> friend@example.test.
app.use('/api/auth', createAuthRouter(async (credential) => ({ sub: credential, email: `${credential}@example.test`, name: credential, email_verified: true })));
app.get('/api/meta', (req, res) => res.json({ first_listing_free: isFirstListing(req.user?.id) || hasFreeListings(req.user?.email), free_account: hasFreeListings(req.user?.email) }));
app.use('/api/listings', listings);
app.use('/api/admin', admin);
const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;

async function request(url, { cookie, token, body, method = body ? 'POST' : 'GET' } = {}) {
  const r = await fetch(base + url, { method, headers: { 'X-Vong-Request': '1', ...(cookie ? { Cookie: cookie } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json(), cookie: r.headers.get('set-cookie') };
}

try {
  const token = (await request('/api/admin/login', { body: { password: 'test-admin-pass' } })).body.token;
  const friend = (await request('/api/auth/google', { body: { credential: 'friend' } })).cookie;
  const stranger = (await request('/api/auth/google', { body: { credential: 'stranger' } })).cookie;
  const listing = { description: 'A listing used to check that some accounts always post for free.', category: 'furniture', price_vnd: 90000, district: 'district_1', condition: 'good', seller_name: 'Seller', seller_phone: '0900000000' };
  const post = async (cookie, title) => (await request('/api/listings', { cookie, body: { ...listing, title } })).body;

  // Bad input is refused; good input is cleaned up (lower case, no duplicates).
  assert.equal((await request('/api/admin/settings', { token, method: 'PUT', body: { free_emails: 'not-an-email' } })).status, 400);
  const saved = await request('/api/admin/settings', { token, method: 'PUT', body: { free_emails: 'Friend@Example.test,\nfriend@example.test; other@example.test' } });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.settings.free_emails, 'friend@example.test, other@example.test');

  // The listed account posts for free every time and skips the payment step.
  assert.equal((await request('/api/meta', { cookie: friend })).body.free_account, true);
  for (const title of ['Free one', 'Free two', 'Free three']) {
    const created = await post(friend, title);
    assert.equal(created.fee_vnd, 0, `${title} is free`);
    assert.equal(created.status, 'awaiting_approval', 'still reviewed by hand');
  }
  assert.equal((await request('/api/meta', { cookie: friend })).body.first_listing_free, true);

  // Everyone else: first listing free, then the normal fee.
  assert.equal((await request('/api/meta', { cookie: stranger })).body.free_account, false);
  assert.equal((await post(stranger, 'Stranger first')).fee_vnd, 0);
  assert.equal((await post(stranger, 'Stranger second')).fee_vnd, 10000);

  // Removing the email ends it.
  await request('/api/admin/settings', { token, method: 'PUT', body: { free_emails: '' } });
  assert.equal((await post(friend, 'Paid now')).fee_vnd, 10000);
  console.log('free email tests passed');
} finally {
  server.close();
  fs.rmSync(directory, { recursive: true, force: true });
}
