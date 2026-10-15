// Hearts and public comments on listings, and sold items staying visible.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vong-engagement-'));
process.env.DATABASE_FILE = path.join(directory, 'test.db');
process.env.UPLOADS_DIR = path.join(directory, 'uploads');
process.env.GOOGLE_CLIENT_ID = 'test-client';
process.env.ADMIN_PASSWORD = 'test-admin-pass';
delete process.env.LISTING_FEE_VND;
delete process.env.RESEND_API_KEY;
delete process.env.NTFY_TOPIC;
const { db } = await import('./db.js');
const { createAuthRouter, sessionUser, protectWrites } = await import('./accounts.js');
const { router: engagement } = await import('./routes/engagement.js');
const { router: listings } = await import('./routes/listings.js');
const { router: admin } = await import('./routes/admin.js');
const { router: sellers } = await import('./routes/sellers.js');
const app = express();
app.use(express.json(), protectWrites, sessionUser);
app.use('/api/auth', createAuthRouter(async (credential) => ({ sub: credential, email: `${credential}@example.test`, name: `Nguyễn Văn ${credential}`, email_verified: true })));
app.use('/api/listings', engagement);
app.use('/api/listings', listings);
app.use('/api/admin', admin);
app.use('/api/sellers', sellers);
const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;
const request = async (url, { cookie, token, body, method = body ? 'POST' : 'GET' } = {}) => {
  const r = await fetch(base + url, { method, headers: { 'X-Vong-Request': '1', ...(cookie ? { Cookie: cookie } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => null), cookie: r.headers.get('set-cookie') };
};
const signIn = async (who) => {
  const r = await request('/api/auth/google', { body: { credential: who } });
  return { cookie: r.cookie, id: r.body.profile.id };
};

try {
  const seller = await signIn('seller');
  const buyer = await signIn('buyer');
  const insert = db.prepare(`INSERT INTO listings (id, ref, title_vi, description_vi, category, price_vnd, district, condition,
    seller_name, seller_phone, status, fee_vnd, created_at, seller_id) VALUES (?, ?, ?, 'Mô tả món đồ', 'furniture', 100000, 'hcm_ben_thanh', 'good', 'An', '0900000000', ?, 0, ?, ?)`);
  insert.run('live', 'VONG-LIVE01', 'Ghế gỗ', 'published', new Date().toISOString(), seller.id);
  insert.run('gone', 'VONG-GONE01', 'Bàn cũ', 'sold', new Date().toISOString(), seller.id);
  insert.run('wait', 'VONG-WAIT01', 'Kệ', 'awaiting_approval', new Date().toISOString(), seller.id);

  // Hearts: one per browser, counted on every listing response.
  const heart = (id, visitor, method = 'POST') => request(`/api/listings/${id}/like`, { method, body: { visitor } });
  assert.equal((await heart('live', 'bad id!')).status, 400);
  assert.equal((await heart('wait', 'browser-aaaa1111')).status, 404, 'not public yet');
  assert.deepEqual((await heart('live', 'browser-aaaa1111')).body, { likes: 1, liked: true });
  assert.equal((await heart('live', 'browser-aaaa1111')).body.likes, 1, 'the same browser counts once');
  assert.equal((await heart('live', 'browser-bbbb2222')).body.likes, 2);
  assert.equal((await request('/api/listings/live')).body.listing.likes, 2);
  assert.equal((await request('/api/listings')).body.listings.find((l) => l.id === 'live').likes, 2);
  assert.equal((await request(`/api/sellers/${seller.id}`)).body.listings.find((l) => l.id === 'live').likes, 2);
  assert.equal((await heart('live', 'browser-aaaa1111', 'DELETE')).body.likes, 1);
  assert.ok(!db.prepare('SELECT liker FROM listing_likes').all().some((r) => r.liker.includes('browser')), 'only a hash is stored');

  // Sold things stay in Browse, after the available ones, and can be filtered.
  const all = (await request('/api/listings')).body.listings.map((l) => [l.id, l.status]);
  assert.deepEqual(all, [['live', 'published'], ['gone', 'sold']]);
  assert.deepEqual((await request('/api/listings?status=available')).body.listings.map((l) => l.id), ['live']);
  assert.deepEqual((await request('/api/listings?status=sold')).body.listings.map((l) => l.id), ['gone']);

  // Comments: public, signed-in to write, on live listings.
  const comment = (who, id, body) => request(`/api/listings/${id}/comments`, { cookie: who?.cookie, body: { body } });
  assert.equal((await comment(null, 'live', 'Còn không bạn?')).status, 401);
  assert.equal((await comment(buyer, 'live', '   ')).status, 400);
  assert.equal((await comment(buyer, 'live', 'x'.repeat(501))).status, 400);
  assert.equal((await comment(buyer, 'gone', 'Còn không?')).status, 404, 'no new comments once sold');
  const asked = await comment(buyer, 'live', 'Còn không bạn? <b>hi</b>');
  assert.equal(asked.status, 201);
  await comment(seller, 'live', 'Còn nha bạn');
  let list = (await request('/api/listings/live/comments')).body.comments;
  assert.deepEqual(list.map((c) => [c.author, c.seller, c.body]), [['Nguyễn B.', false, 'Còn không bạn? <b>hi</b>'], ['Nguyễn S.', true, 'Còn nha bạn']]);
  assert.ok(list.every((c) => !('user_id' in c) && !('email' in c)), 'no ids or emails in public comments');
  assert.equal(list[0].can_delete, false, 'signed out: nothing to delete');
  list = (await request('/api/listings/live/comments', { cookie: seller.cookie })).body.comments;
  assert.ok(list.every((c) => c.can_delete), 'the seller can remove any comment on their listing');

  // Deleting: the author or the seller; others cannot; the admin can remove any.
  const stranger = await signIn('stranger');
  assert.equal((await request(`/api/listings/live/comments/${asked.body.id}`, { cookie: stranger.cookie, method: 'DELETE' })).status, 403);
  assert.equal((await request(`/api/listings/live/comments/${asked.body.id}`, { cookie: buyer.cookie, method: 'DELETE' })).status, 200);
  assert.equal((await request('/api/listings/live/comments')).body.comments.length, 1);
  const token = (await request('/api/admin/login', { body: { password: 'test-admin-pass' } })).body.token;
  const reply = (await request('/api/listings/live/comments')).body.comments[0].id;
  assert.equal((await request(`/api/admin/comments/${reply}`, { method: 'DELETE' })).status, 401);
  assert.equal((await request(`/api/admin/comments/${reply}`, { token, method: 'DELETE' })).status, 200);
  assert.equal((await request('/api/listings/live/comments')).body.comments.length, 0);

  // Comments on a sold listing stay readable.
  db.prepare("INSERT INTO listing_comments (listing_id, user_id, body, created_at) VALUES ('gone', ?, 'Hết rồi hả?', ?)").run(buyer.id, new Date().toISOString());
  assert.equal((await request('/api/listings/gone/comments')).body.comments.length, 1);
  assert.equal((await request('/api/listings/wait/comments')).status, 404);

  console.log('engagement tests passed');
} finally {
  server.close();
  fs.rmSync(directory, { recursive: true, force: true });
}
