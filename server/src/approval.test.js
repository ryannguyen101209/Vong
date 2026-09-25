import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vong-approval-'));
process.env.DATABASE_FILE = path.join(directory, 'test.db');
process.env.UPLOADS_DIR = path.join(directory, 'uploads');
process.env.GOOGLE_CLIENT_ID = 'test-client';
process.env.CORS_ORIGIN = 'http://localhost:5174';
process.env.ADMIN_PASSWORD = 'test-admin-password';
process.env.PUBLIC_URL = 'https://vong.test';
const { db } = await import('./db.js');
const { createAuthRouter, sessionUser, protectWrites } = await import('./accounts.js');
const { router: listings } = await import('./routes/listings.js');
const { router: admin } = await import('./routes/admin.js');
const { setMailTransportForTests } = await import('./mailer.js');

const outbox = [];
let mailFails = false;
const fakeTransport = {
  async sendMail(message) {
    if (mailFails) throw new Error('SMTP refused');
    outbox.push(message);
  },
};

const app = express();
app.use(express.json(), protectWrites, sessionUser);
app.use('/api/auth', createAuthRouter(async (credential) => ({ sub: credential, email: `${credential}@example.test`, name: credential, email_verified: true })));
app.use('/api/listings', listings);
app.use('/api/admin', admin);
const server = await new Promise((resolve) => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
const base = `http://127.0.0.1:${server.address().port}`;

async function request(url, { cookie, token, body, method = body ? 'POST' : 'GET' } = {}) {
  const headers = { 'X-Vong-Request': '1' };
  if (cookie) headers.Cookie = cookie;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const response = await fetch(base + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie') };
}

const listingBody = (extra = {}) => ({
  title: 'Approval test desk', description: 'A listing used to check the approval key flow from start to finish.',
  category: 'furniture', price_vnd: 300000, district: 'district_1', condition: 'good',
  seller_name: 'Seller', seller_phone: '0900000000', seller_email: 'shop@example.test', ...extra,
});
const keyFrom = (message) => message.text.match(/\b([A-Z2-9]{4}-[A-Z2-9]{4})\b/)[1];

try {
  const seller = await request('/api/auth/google', { body: { credential: 'seller' } });
  const other = await request('/api/auth/google', { body: { credential: 'other' } });
  const { token } = (await request('/api/admin/login', { body: { password: 'test-admin-password' } })).body;
  assert.ok(token);

  // Mail configured: approval emails the key to the address the seller gave.
  setMailTransportForTests(fakeTransport);
  const created = await request('/api/listings', { cookie: seller.cookie, body: listingBody() });
  const id = created.body.id;
  assert.equal((await request(`/api/admin/listings/${id}/approve`, { token, body: {} })).status, 409);
  await request(`/api/listings/${id}/mark-paid`, { cookie: seller.cookie, body: {} });
  assert.equal((await request(`/api/listings/${id}/publish`, { cookie: seller.cookie, body: { key: 'AAAA-AAAA' } })).status, 409);
  assert.equal((await request(`/api/admin/listings/${id}/approve`, { body: {} })).status, 401);

  const approved = await request(`/api/admin/listings/${id}/approve`, { token, body: {} });
  assert.equal(approved.status, 200);
  assert.equal(approved.body.status, 'approved');
  assert.equal(approved.body.delivery, 'sent');
  assert.equal(approved.body.key, undefined, 'a key that was emailed is not shown to the admin');
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0].to, 'shop@example.test');
  assert.match(outbox[0].text, new RegExp(`https://vong.test/payment/${id}`));
  const key = keyFrom(outbox[0]);
  assert.ok(!db.prepare('SELECT publish_key_hash FROM listings WHERE id = ?').get(id).publish_key_hash.includes(key.replace('-', '')), 'only a hash is stored');

  // Approved is not public yet.
  assert.equal((await request(`/api/listings/${id}`)).status, 404);
  assert.equal((await request('/api/listings')).body.listings.length, 0);
  const status = await request(`/api/listings/${id}/payment`, { cookie: seller.cookie });
  assert.equal(status.body.listing.status, 'approved');
  assert.equal(status.body.key.sent_to, 'shop@example.test');
  assert.equal(status.body.key.attempts_left, 5);
  assert.equal(status.body.key.can_resend, true);

  // Only the owner can use the key, and a wrong key costs an attempt.
  assert.equal((await request(`/api/listings/${id}/publish`, { cookie: other.cookie, body: { key } })).status, 404);
  assert.equal((await request(`/api/listings/${id}/publish`, { body: { key } })).status, 401);
  const wrong = await request(`/api/listings/${id}/publish`, { cookie: seller.cookie, body: { key: 'ZZZZ-ZZZZ' } });
  assert.equal(wrong.status, 400);
  assert.equal(wrong.body.error, 'wrong_key');
  assert.equal(wrong.body.attempts_left, 4);

  // Lower case and missing dash are fine.
  const published = await request(`/api/listings/${id}/publish`, { cookie: seller.cookie, body: { key: ` ${key.replace('-', '').toLowerCase()} ` } });
  assert.equal(published.status, 200);
  assert.equal(published.body.status, 'published');
  assert.equal((await request(`/api/listings/${id}`)).status, 200);
  assert.equal((await request('/api/listings')).body.listings.length, 1);
  assert.equal(db.prepare('SELECT publish_key_hash FROM listings WHERE id = ?').get(id).publish_key_hash, null);

  // Five wrong keys lock it; a resent key works again.
  const second = (await request('/api/listings', { cookie: seller.cookie, body: listingBody({ title: 'Second approval test' }) })).body.id;
  await request(`/api/listings/${second}/mark-paid`, { cookie: seller.cookie, body: {} });
  await request(`/api/admin/listings/${second}/approve`, { token, body: {} });
  const firstKey = keyFrom(outbox.at(-1));
  let last;
  for (let i = 0; i < 5; i += 1) last = await request(`/api/listings/${second}/publish`, { cookie: seller.cookie, body: { key: 'WRNG-WRNG' } });
  assert.equal(last.body.error, 'key_locked');
  assert.equal((await request(`/api/listings/${second}/publish`, { cookie: seller.cookie, body: { key: firstKey } })).body.error, 'key_locked');
  assert.equal((await request(`/api/listings/${second}/resend-key`, { cookie: seller.cookie, body: {} })).body.error, 'resend_too_soon');
  db.prepare("UPDATE listings SET publish_key_sent_at = '2000-01-01T00:00:00.000Z' WHERE id = ?").run(second);
  assert.equal((await request(`/api/listings/${second}/resend-key`, { cookie: other.cookie, body: {} })).status, 404);
  const resent = await request(`/api/listings/${second}/resend-key`, { cookie: seller.cookie, body: {} });
  assert.equal(resent.body.delivery, 'sent');
  const freshKey = keyFrom(outbox.at(-1));
  assert.notEqual(freshKey, firstKey);
  assert.equal((await request(`/api/listings/${second}/publish`, { cookie: seller.cookie, body: { key: firstKey } })).body.error, 'wrong_key');
  assert.equal((await request(`/api/listings/${second}/publish`, { cookie: seller.cookie, body: { key: freshKey } })).body.status, 'published');

  // Expired keys are refused.
  const third = (await request('/api/listings', { cookie: seller.cookie, body: listingBody({ title: 'Third approval test' }) })).body.id;
  await request(`/api/listings/${third}/mark-paid`, { cookie: seller.cookie, body: {} });
  await request(`/api/admin/listings/${third}/approve`, { token, body: {} });
  const thirdKey = keyFrom(outbox.at(-1));
  db.prepare('UPDATE listings SET publish_key_expires_at = ? WHERE id = ?').run(Date.now() - 1, third);
  assert.equal((await request(`/api/listings/${third}/publish`, { cookie: seller.cookie, body: { key: thirdKey } })).body.error, 'key_expired');
  assert.equal((await request(`/api/listings/${third}/payment`, { cookie: seller.cookie })).body.key.expired, true);

  // The admin can resend, and can still reject an approved listing.
  const adminResent = await request(`/api/admin/listings/${third}/resend-key`, { token, body: {} });
  assert.equal(adminResent.body.delivery, 'sent');
  const rejected = await request(`/api/admin/listings/${third}/reject`, { token, body: { reason: 'Photo shows a different item' } });
  assert.equal(rejected.body.delivery, 'sent');
  assert.match(outbox.at(-1).text, /Photo shows a different item/);
  assert.equal((await request(`/api/listings/${third}/publish`, { cookie: seller.cookie, body: { key: keyFrom(outbox.at(-2)) } })).status, 409);

  // A seller's resend that fails to send leaves their current key working.
  const keeper = (await request('/api/listings', { cookie: seller.cookie, body: listingBody({ title: 'Resend failure test' }) })).body.id;
  await request(`/api/listings/${keeper}/mark-paid`, { cookie: seller.cookie, body: {} });
  await request(`/api/admin/listings/${keeper}/approve`, { token, body: {} });
  const keeperKey = keyFrom(outbox.at(-1));
  db.prepare("UPDATE listings SET publish_key_sent_at = '2000-01-01T00:00:00.000Z' WHERE id = ?").run(keeper);
  mailFails = true;
  assert.equal((await request(`/api/listings/${keeper}/resend-key`, { cookie: seller.cookie, body: {} })).body.error, 'mail_failed');
  assert.equal((await request(`/api/listings/${keeper}/publish`, { cookie: seller.cookie, body: { key: keeperKey } })).body.status, 'published');

  // A mail server failure still approves, and hands the admin the key.
  mailFails = true;
  const fourth = (await request('/api/listings', { cookie: seller.cookie, body: listingBody({ title: 'Fourth approval test' }) })).body.id;
  await request(`/api/listings/${fourth}/mark-paid`, { cookie: seller.cookie, body: {} });
  const failed = await request(`/api/admin/listings/${fourth}/approve`, { token, body: {} });
  assert.equal(failed.body.delivery, 'failed');
  assert.match(failed.body.key, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal((await request(`/api/listings/${fourth}/publish`, { cookie: seller.cookie, body: { key: failed.body.key } })).body.status, 'published');

  // No mail server at all: the admin gets the key to send by hand.
  mailFails = false;
  setMailTransportForTests(null);
  delete process.env.SMTP_HOST;
  const fifth = (await request('/api/listings', { cookie: seller.cookie, body: listingBody({ title: 'Fifth approval test' }) })).body.id;
  await request(`/api/listings/${fifth}/mark-paid`, { cookie: seller.cookie, body: {} });
  const manual = await request(`/api/admin/listings/${fifth}/approve`, { token, body: {} });
  assert.equal(manual.body.delivery, 'not_configured');
  assert.equal(manual.body.sent_to, 'shop@example.test');
  assert.equal((await request(`/api/listings/${fifth}/payment`, { cookie: seller.cookie })).body.key.can_resend, false);
  assert.equal((await request(`/api/listings/${fifth}/resend-key`, { cookie: seller.cookie, body: {} })).body.error, 'mail_not_configured');
  assert.equal((await request(`/api/listings/${fifth}/publish`, { cookie: seller.cookie, body: { key: manual.body.key } })).body.status, 'published');

  const counts = (await request('/api/admin/listings?status=approved', { token })).body.counts;
  assert.equal(counts.published, 5);
  assert.equal(counts.rejected, 1);
  console.log('approval: passed key email, hashing, owner-only entry, attempt lock, resend, expiry, rejection, mail failure, failed resend and manual delivery tests.');
} finally {
  await new Promise((resolve) => server.close(resolve));
  db.close();
  fs.rmSync(directory, { recursive: true, force: true });
}
