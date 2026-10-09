import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vong-security-'));
process.env.DATABASE_FILE = path.join(directory, 'test.db');
process.env.UPLOADS_DIR = path.join(directory, 'uploads');
process.env.GOOGLE_CLIENT_ID = 'test-client';
process.env.ADMIN_PASSWORD = 'test-admin-pass';
delete process.env.RESEND_API_KEY;
delete process.env.NTFY_TOPIC;
const { createAuthRouter, sessionUser, protectWrites } = await import('./accounts.js');
const { router: listings } = await import('./routes/listings.js');
const { router: admin } = await import('./routes/admin.js');
const { adminPassword, login } = await import('./auth.js');
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
  // No built-in password in production.
  const saved = { password: process.env.ADMIN_PASSWORD, env: process.env.NODE_ENV };
  delete process.env.ADMIN_PASSWORD;
  process.env.NODE_ENV = 'production';
  assert.equal(adminPassword(), '');
  assert.equal(login('vong-admin'), null);
  assert.equal(login(''), null);
  process.env.NODE_ENV = 'development';
  assert.equal(adminPassword(), 'vong-admin');
  process.env.ADMIN_PASSWORD = saved.password;
  if (saved.env === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = saved.env;

  // A seller edits a listing after approval: it is flagged for the owner.
  const sellerCookie = (await request('/api/auth/google', { body: { credential: 'seller' } })).cookie;
  const token = (await request('/api/admin/login', { body: { password: 'test-admin-pass' } })).body.token;
  const listing = { title: 'Security test chair', description: 'A plain chair used to check edits after approval.', category: 'furniture', price_vnd: 150000, district: 'district_1', condition: 'good', seller_name: 'Seller', seller_phone: '0900000000' };
  const id = (await request('/api/listings', { cookie: sellerCookie, body: listing })).body.id;
  const editedAt = async () => (await request('/api/admin/listings?status=all', { token })).body.listings.find((l) => l.id === id).edited_at;

  // Edits before approval are not flagged: the owner has not reviewed it yet.
  assert.equal((await request(`/api/listings/${id}`, { cookie: sellerCookie, method: 'PATCH', body: { price_vnd: 140000 } })).status, 200);
  assert.equal(await editedAt(), null);

  assert.equal((await request(`/api/admin/listings/${id}/approve`, { token, method: 'POST' })).status, 200);
  // Saving with nothing changed is not an edit.
  assert.equal((await request(`/api/listings/${id}`, { cookie: sellerCookie, method: 'PATCH', body: {} })).status, 200);
  assert.equal(await editedAt(), null);
  // Changing the description after approval is.
  assert.equal((await request(`/api/listings/${id}`, { cookie: sellerCookie, method: 'PATCH', body: { description: 'Now asking for a deposit by bank transfer before viewing.' } })).status, 200);
  assert.ok(await editedAt(), 'edit after approval is flagged');

  // Wrong admin passwords are limited; the right one is not counted.
  for (let i = 0; i < 10; i += 1) assert.equal((await request('/api/admin/login', { body: { password: `guess-${i}` } })).status, 401);
  assert.equal((await request('/api/admin/login', { body: { password: 'guess-11' } })).status, 429);
  assert.equal((await request('/api/admin/login', { body: { password: 'test-admin-pass' } })).status, 429, 'locked out until the window passes');

  console.log('security tests passed');
} finally {
  server.close();
  fs.rmSync(directory, { recursive: true, force: true });
}
