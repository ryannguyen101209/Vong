import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vong-browse-'));
process.env.DATABASE_FILE = path.join(directory, 'test.db');
process.env.UPLOADS_DIR = path.join(directory, 'uploads');
process.env.GOOGLE_CLIENT_ID = 'test-client';
delete process.env.RESEND_API_KEY;
const { db } = await import('./db.js');
const { createAuthRouter, sessionUser, protectWrites } = await import('./accounts.js');
const { router: listings } = await import('./routes/listings.js');
const app = express();
app.use(express.json(), protectWrites, sessionUser);
app.use('/api/auth', createAuthRouter(async (credential) => ({ sub: credential, email: `${credential}@example.test`, name: credential, email_verified: true })));
app.use('/api/listings', listings);
const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;

async function request(url, { cookie, body } = {}) {
  const response = await fetch(base + url, { method: body ? 'POST' : 'GET', headers: { 'X-Vong-Request': '1', ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie') };
}

try {
  const seller = await request('/api/auth/google', { body: { credential: 'seller' } });
  const base_ = { description: 'A test listing used to check the district and price filters.', category: 'furniture', condition: 'good', seller_name: 'Seller', seller_phone: '0900000000' };
  const make = async (title, district, price_vnd) => (await request('/api/listings', { cookie: seller.cookie, body: { ...base_, title, district, price_vnd } })).body.id;
  const ids = {
    cheap1: await make('Browse cheap lamp', 'district_1', 150000),
    edge: await make('Browse edge stool', 'district_1', 200000),
    mid3: await make('Browse mid chair', 'district_3', 450000),
    dear3: await make('Browse dear sofa', 'district_3', 3500000),
  };
  db.prepare("UPDATE listings SET status = 'published' WHERE is_seed = 0").run();

  const titles = async (query) => (await request(`/api/listings?${query}`)).body.listings.map((l) => l.id).sort();
  const pick = (...keys) => keys.map((k) => ids[k]).sort();

  assert.deepEqual(await titles(''), pick('cheap1', 'edge', 'mid3', 'dear3'));
  assert.deepEqual(await titles('district=district_3'), pick('mid3', 'dear3'));
  assert.deepEqual(await titles('max_price=199999'), pick('cheap1'), 'under 200k excludes exactly 200k');
  assert.deepEqual(await titles('min_price=200000&max_price=499999'), pick('edge', 'mid3'));
  assert.deepEqual(await titles('min_price=3000000'), pick('dear3'));
  assert.deepEqual(await titles('district=district_1&min_price=200000'), pick('edge'), 'filters combine');

  // Junk values are ignored rather than breaking the page.
  assert.deepEqual(await titles('district=not_a_district'), pick('cheap1', 'edge', 'mid3', 'dear3'));
  assert.deepEqual(await titles('min_price=abc&max_price=-5'), pick('cheap1', 'edge', 'mid3', 'dear3'));
  assert.equal((await request("/api/listings?district=district_1'%20OR%201=1--")).body.listings.length, 4);

  console.log('browse filter tests passed');
} finally {
  server.close();
}
