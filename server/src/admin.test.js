import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vong-admin-'));
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
  const token = (await request('/api/admin/login', { body: { password: 'test-admin-pass' } })).body.token;
  const listing = { title: 'Admin test lamp', description: 'A test listing used to check the admin listing count and delete.', category: 'furniture', price_vnd: 90000, district: 'district_1', condition: 'good', seller_name: 'Seller', seller_phone: '0900000000' };
  const ids = [];
  for (const title of ['Admin test lamp one', 'Admin test lamp two', 'Admin test lamp three']) {
    ids.push((await request('/api/listings', { cookie: seller.cookie, body: { ...listing, title } })).body.id);
  }

  // Each listing knows its place among the seller's listings.
  const all = (await request('/api/admin/listings?status=all', { token })).body.listings;
  const byId = Object.fromEntries(all.map((l) => [l.id, l]));
  assert.deepEqual(ids.map((id) => byId[id].seller_index), [1, 2, 3]);
  assert.deepEqual(ids.map((id) => byId[id].seller_total), [3, 3, 3]);
  assert.deepEqual(ids.map((id) => byId[id].is_first_listing), [true, false, false]);

  // Delete needs the admin token.
  assert.equal((await request(`/api/admin/listings/${ids[1]}`, { method: 'DELETE' })).status, 401);
  assert.equal((await request(`/api/admin/listings/${ids[1]}`, { cookie: seller.cookie, method: 'DELETE' })).status, 401);

  // The owner deletes one: it leaves the admin lists and the public page.
  assert.equal((await request(`/api/admin/listings/${ids[1]}`, { token, method: 'DELETE' })).status, 200);
  assert.equal((await request(`/api/admin/listings/${ids[1]}`, { token, method: 'DELETE' })).status, 404, 'deleting twice is not found');
  assert.equal((await request('/api/admin/listings/missing-id', { token, method: 'DELETE' })).status, 404);
  const queue = (await request('/api/admin/listings?status=queue', { token })).body.listings.map((l) => l.id);
  assert.ok(!queue.includes(ids[1]) && queue.includes(ids[0]) && queue.includes(ids[2]));
  assert.equal((await request(`/api/listings/${ids[1]}`)).status, 404);

  // Numbering is unchanged: a deleted listing still counts, so no second free listing.
  const after = Object.fromEntries((await request('/api/admin/listings?status=queue', { token })).body.listings.map((l) => [l.id, l]));
  assert.equal(after[ids[2]].seller_index, 3);

  console.log('admin tests passed');
} finally {
  server.close();
}
