import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vong-reports-'));
process.env.DATABASE_FILE = path.join(directory, 'test.db');
process.env.UPLOADS_DIR = path.join(directory, 'uploads');
process.env.GOOGLE_CLIENT_ID = 'test-client';
process.env.ADMIN_PASSWORD = 'test-admin-pass';
delete process.env.RESEND_API_KEY;
delete process.env.NTFY_TOPIC;
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
  return { status: response.status, body: await response.json() };
}

try {
  const sellerCookie = (await fetch(base + '/api/auth/google', { method: 'POST', headers: { 'X-Vong-Request': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: 'seller' }) })).headers.get('set-cookie');
  const token = (await request('/api/admin/login', { body: { password: 'test-admin-pass' } })).body.token;
  const listing = { title: 'Report test bike', description: 'A listing used to check that reports reach the owner.', category: 'sports', price_vnd: 900000, district: 'district_1', condition: 'good', seller_name: 'Seller', seller_phone: '0900000000' };
  const id = (await request('/api/listings', { cookie: sellerCookie, body: listing })).body.id;
  assert.ok(id);

  // Not public yet: nothing to report.
  assert.equal((await request(`/api/listings/${id}/report`, { body: { reason: 'scam' } })).status, 404);
  assert.equal((await request(`/api/admin/listings/${id}/approve`, { token, method: 'POST' })).status, 200);

  // Bad input is refused.
  assert.equal((await request(`/api/listings/${id}/report`, { body: { reason: 'boring' } })).status, 400);
  assert.equal((await request(`/api/listings/${id}/report`, { body: { reason: 'other' } })).status, 400, 'other needs details');
  assert.equal((await request('/api/listings/missing/report', { body: { reason: 'scam' } })).status, 404);

  // Anyone can report, signed in or not.
  assert.equal((await request(`/api/listings/${id}/report`, { body: { reason: 'scam', details: 'Asked for a deposit first.' } })).status, 201);
  assert.equal((await request(`/api/listings/${id}/report`, { cookie: sellerCookie, body: { reason: 'other', details: 'Wrong district' } })).status, 201);

  // Only the owner sees reports.
  assert.equal((await request('/api/admin/reports')).status, 401);
  let reports = (await request('/api/admin/reports', { token })).body.reports;
  assert.equal(reports.length, 2);
  assert.equal(reports.find((r) => r.reason === 'scam').details, 'Asked for a deposit first.');
  assert.equal(reports[0].title_vi ?? reports[0].title_en, 'Report test bike');

  // Dismissing closes one report; taking the listing down settles the rest.
  assert.equal((await request(`/api/admin/reports/${reports[0].id}/dismiss`, { token, method: 'POST' })).status, 200);
  assert.equal((await request(`/api/admin/reports/${reports[0].id}/dismiss`, { token, method: 'POST' })).status, 404);
  assert.equal((await request('/api/admin/reports', { token })).body.reports.length, 1);
  assert.equal((await request(`/api/admin/listings/${id}`, { token, method: 'DELETE' })).status, 200);
  assert.equal((await request('/api/admin/reports', { token })).body.reports.length, 0);

  console.log('report tests passed');
} finally {
  server.close();
  fs.rmSync(directory, { recursive: true, force: true });
}
