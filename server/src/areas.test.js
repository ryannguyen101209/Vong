// Saigon's new wards, older listings that keep their district, the admin city
// filter, and the admin stats that replaced the earnings figures.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vong-areas-'));
process.env.DATABASE_FILE = path.join(directory, 'test.db');
process.env.UPLOADS_DIR = path.join(directory, 'uploads');
process.env.GOOGLE_CLIENT_ID = 'test-client';
process.env.ADMIN_PASSWORD = 'test-admin-pass';
delete process.env.LISTING_FEE_VND;
delete process.env.RESEND_API_KEY;
delete process.env.NTFY_TOPIC;
const { db } = await import('./db.js');
const { HCM_WARDS } = await import('./hcm-wards.js');
const { HCM_WARDS: CLIENT_WARDS } = await import('../../client/src/lib/hcm-wards.js');
const { CITY_DISTRICTS } = await import('./seed-data.js');
const { createAuthRouter, sessionUser, protectWrites } = await import('./accounts.js');
const { router: listings } = await import('./routes/listings.js');
const { router: admin } = await import('./routes/admin.js');
const { router: conversations } = await import('./routes/conversations.js');
const app = express();
app.use(express.json(), protectWrites, sessionUser);
app.use('/api/auth', createAuthRouter(async (credential) => ({ sub: credential, email: `${credential}@example.test`, name: credential, email_verified: true })));
app.use('/api/listings', listings);
app.use('/api/admin', admin);
app.use('/api/conversations', conversations);
const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;

async function request(url, { cookie, token, body, method = body ? 'POST' : 'GET' } = {}) {
  const r = await fetch(base + url, { method, headers: { 'X-Vong-Request': '1', ...(cookie ? { Cookie: cookie } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json(), cookie: r.headers.get('set-cookie') };
}
const signIn = async (who) => (await request('/api/auth/google', { body: { credential: who } })).cookie;

try {
  // 168 units since July 2025: 113 phường, 54 xã, 1 đặc khu, unique keys, same list on both sides.
  assert.equal(HCM_WARDS.length, 168);
  const kinds = HCM_WARDS.reduce((n, w) => ({ ...n, [w.name.split(' ')[0]]: (n[w.name.split(' ')[0]] ?? 0) + 1 }), {});
  assert.deepEqual(kinds, { Phường: 113, Xã: 54, Đặc: 1 });
  assert.equal(new Set(HCM_WARDS.map((w) => w.key)).size, 168);
  assert.deepEqual(CLIENT_WARDS, HCM_WARDS, 'client and server ward lists match');
  assert.deepEqual(CITY_DISTRICTS.ho_chi_minh, HCM_WARDS.map((w) => w.key), 'Saigon offers the wards');

  const token = (await request('/api/admin/login', { body: { password: 'test-admin-pass' } })).body.token;
  const seller = await signIn('seller');
  const buyer = await signIn('buyer');
  const listing = { description: 'A listing used to check wards, cities and admin stats.', category: 'furniture', price_vnd: 90000, condition: 'good', seller_name: 'Linh', seller_phone: '0900000000' };
  const post = (extra) => request('/api/listings', { cookie: seller, body: { ...listing, ...extra } });

  // New Saigon listings take a ward, not an old district.
  const ward = await post({ title: 'Ghế phường Bến Thành', district: 'hcm_ben_thanh' });
  assert.equal(ward.status, 201);
  const oldDistrict = await post({ title: 'Ghế quận 1', district: 'district_1' });
  assert.equal(oldDistrict.status, 400);
  assert.equal(oldDistrict.body.fields.district, 'invalid');
  const hanoi = await post({ title: 'Bàn Hà Nội', city: 'ha_noi', district: 'hn_ba_dinh' });
  assert.equal(hanoi.status, 201);

  // A listing written before keeps its district: still shown, filterable and editable.
  const sellerId = db.prepare('SELECT seller_id FROM listings WHERE id = ?').get(ward.body.id).seller_id;
  db.prepare(`INSERT INTO listings (id, ref, title_vi, description_vi, category, price_vnd, city, district, condition,
    seller_name, seller_phone, status, fee_vnd, created_at, published_at, seller_id)
    VALUES ('legacy', 'VONG-LEGACY1', 'Tủ cũ quận 1', 'Tin đăng từ trước khi có phường mới.', 'furniture', 100000, 'ho_chi_minh', 'district_1', 'good',
    'Linh', '0900000000', 'published', 0, ?, ?, ?)`).run(new Date().toISOString(), new Date().toISOString(), sellerId);
  assert.deepEqual((await request('/api/listings?district=district_1')).body.listings.map((l) => l.id), ['legacy']);
  const edited = await request('/api/listings/legacy', { cookie: seller, method: 'PATCH', body: { price_vnd: 120000 } });
  assert.equal(edited.status, 200, 'editing an older listing keeps its district');
  assert.equal(db.prepare('SELECT district FROM listings WHERE id = ?').get('legacy').district, 'district_1');
  const moved = await request('/api/listings/legacy', { cookie: seller, method: 'PATCH', body: { district: 'district_3' } });
  assert.equal(moved.status, 400, 'but cannot move to another old district');

  // Admin: filter listings by city, with a count for each city.
  await request(`/api/admin/listings/${ward.body.id}/approve`, { token, method: 'POST' });
  await request(`/api/admin/listings/${hanoi.body.id}/approve`, { token, method: 'POST' });
  const all = (await request('/api/admin/listings?status=published', { token })).body;
  assert.deepEqual(all.city_counts, { ho_chi_minh: 2, ha_noi: 1 });
  const onlyHanoi = (await request('/api/admin/listings?status=published&city=ha_noi', { token })).body.listings;
  assert.deepEqual(onlyHanoi.map((l) => l.id), [hanoi.body.id]);
  const onlySaigon = (await request('/api/admin/listings?status=published&city=ho_chi_minh', { token })).body.listings;
  assert.deepEqual(onlySaigon.map((l) => l.id).sort(), [ward.body.id, 'legacy'].sort());
  assert.equal((await request('/api/admin/listings?status=published&city=atlantis', { token })).body.listings.length, 3, 'unknown city: no filter');

  // Admin stats: sold, seller reply rate, and each city.
  const convo = (await request('/api/conversations', { cookie: buyer, body: { listingId: ward.body.id } })).body.conversation.id;
  await request(`/api/conversations/${convo}/messages`, { cookie: buyer, body: { body: 'Còn không?', clientId: 'areas-buyer-0001' } });
  await request('/api/conversations', { cookie: buyer, body: { listingId: hanoi.body.id } });
  let report = (await request('/api/admin/analytics', { token })).body;
  assert.deepEqual(report.replies_30d, { chats: 2, answered: 0 });
  await request(`/api/conversations/${convo}/messages`, { cookie: seller, body: { body: 'Còn nha', clientId: 'areas-seller-0001' } });
  assert.equal((await request(`/api/listings/${ward.body.id}/sold`, { cookie: seller, method: 'POST' })).status, 200);
  report = (await request('/api/admin/analytics', { token })).body;
  assert.deepEqual(report.replies_30d, { chats: 2, answered: 1 });
  assert.deepEqual(report.sold, { total: 1, last_30d: 1 });
  const saigon = report.cities.find((c) => c.city === 'ho_chi_minh');
  assert.deepEqual({ live: saigon.live, sold: saigon.sold, new_30d: saigon.new_30d }, { live: 1, sold: 1, new_30d: 2 });
  assert.equal(report.cities.find((c) => c.city === 'ha_noi').live, 1);

  console.log('area and admin stats tests passed');
} finally {
  server.close();
  fs.rmSync(directory, { recursive: true, force: true });
}
