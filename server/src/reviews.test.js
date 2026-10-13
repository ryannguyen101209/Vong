import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vong-reviews-'));
process.env.DATABASE_FILE = path.join(directory, 'test.db');
process.env.UPLOADS_DIR = path.join(directory, 'uploads');
process.env.GOOGLE_CLIENT_ID = 'test-client';
process.env.ADMIN_PASSWORD = 'test-admin-pass';
delete process.env.LISTING_FEE_VND;
delete process.env.RESEND_API_KEY;
delete process.env.NTFY_TOPIC;
const { createAuthRouter, sessionUser, protectWrites } = await import('./accounts.js');
const { router: listings } = await import('./routes/listings.js');
const { router: admin } = await import('./routes/admin.js');
const { router: conversations } = await import('./routes/conversations.js');
const { router: sellers, shortName } = await import('./routes/sellers.js');
const { router: siteReviews } = await import('./routes/site-reviews.js');
const app = express();
app.use(express.json(), protectWrites, sessionUser);
app.use('/api/auth', createAuthRouter(async (credential) => ({ sub: credential, email: `${credential}@example.test`, name: `Nguyễn Văn ${credential}`, email_verified: true })));
app.use('/api/listings', listings);
app.use('/api/admin', admin);
app.use('/api/conversations', conversations);
app.use('/api/sellers', sellers);
app.use('/api/site-reviews', siteReviews);
const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;

async function request(url, { cookie, token, body, method = body ? 'POST' : 'GET' } = {}) {
  const r = await fetch(base + url, { method, headers: { 'X-Vong-Request': '1', ...(cookie ? { Cookie: cookie } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json(), cookie: r.headers.get('set-cookie') };
}
const signIn = async (who) => {
  const r = await request('/api/auth/google', { body: { credential: who } });
  return { cookie: r.cookie, id: r.body.profile.id };
};

try {
  assert.equal(shortName('Nguyễn Văn Linh'), 'Nguyễn L.');
  assert.equal(shortName('Linh'), 'Linh');

  const token = (await request('/api/admin/login', { body: { password: 'test-admin-pass' } })).body.token;
  const seller = await signIn('seller');
  const buyer = await signIn('buyer');
  const stranger = await signIn('stranger');
  const listing = { description: 'A listing used to check seller profiles and reviews work properly.', category: 'furniture', price_vnd: 90000, district: 'hcm_ben_thanh', condition: 'good', seller_name: 'Linh', seller_phone: '0900000000' };
  const id = (await request('/api/listings', { cookie: seller.cookie, body: { ...listing, title: 'Ghế gỗ teak' } })).body.id;

  // No public listings yet: no public profile.
  assert.equal((await request(`/api/sellers/${seller.id}`)).status, 404);
  assert.equal((await request(`/api/admin/listings/${id}/approve`, { token, method: 'POST' })).status, 200);

  // The profile shows the seller's chosen name, listings, no badge and no rating yet.
  let profile = (await request(`/api/sellers/${seller.id}`)).body;
  assert.equal(profile.seller.name, 'Linh');
  assert.equal(profile.seller.trusted, false);
  assert.equal(profile.seller.rating_count, 0);
  assert.equal(profile.listings.length, 1);
  assert.ok(!('seller_phone' in profile.listings[0]), 'no phone numbers on the profile');
  assert.equal((await request(`/api/listings/${id}`)).body.seller.name, 'Linh');

  // Reviews need a real conversation where the seller replied.
  const review = { listing_id: id, rating: 5, body: 'Giao đúng hẹn, đồ như mô tả.' };
  assert.equal((await request(`/api/sellers/${seller.id}/reviews`, { body: review })).status, 401);
  assert.equal((await request(`/api/sellers/${seller.id}/reviews`, { cookie: stranger.cookie, body: review })).body.error, 'not_eligible');
  const convo = (await request('/api/conversations', { cookie: buyer.cookie, body: { listingId: id } })).body.conversation.id;
  await request(`/api/conversations/${convo}/messages`, { cookie: buyer.cookie, body: { body: 'Còn không bạn?', clientId: 'buyer-msg-0001' } });
  assert.equal((await request(`/api/sellers/${seller.id}/reviews`, { cookie: buyer.cookie, body: review })).body.error, 'not_eligible', 'seller has not replied yet');
  await request(`/api/conversations/${convo}/messages`, { cookie: seller.cookie, body: { body: 'Còn nha', clientId: 'seller-msg-0001' } });
  assert.deepEqual((await request(`/api/sellers/${seller.id}`, { cookie: buyer.cookie })).body.can_review.map((l) => l.id), [id]);
  assert.equal((await request(`/api/sellers/${seller.id}/reviews`, { cookie: seller.cookie, body: review })).body.error, 'own_profile');
  assert.equal((await request(`/api/sellers/${seller.id}/reviews`, { cookie: buyer.cookie, body: { ...review, rating: 6 } })).status, 400);
  assert.equal((await request(`/api/sellers/${seller.id}/reviews`, { cookie: buyer.cookie, body: { ...review, body: 'ok' } })).status, 400);
  assert.equal((await request(`/api/sellers/${seller.id}/reviews`, { cookie: buyer.cookie, body: review })).status, 201);
  assert.equal((await request(`/api/sellers/${seller.id}/reviews`, { cookie: buyer.cookie, body: review })).body.error, 'not_eligible', 'one review per listing');

  profile = (await request(`/api/sellers/${seller.id}`, { cookie: buyer.cookie })).body;
  assert.equal(profile.seller.rating_count, 1);
  assert.equal(profile.seller.rating_avg, 5);
  assert.equal(profile.reviews[0].reviewer, 'Nguyễn B.');
  assert.ok(!('reviewer_id' in profile.reviews[0]) && !('email' in profile.reviews[0]), 'no reviewer ids or emails');
  assert.deepEqual(profile.can_review, []);

  // The owner gives and removes the trusted badge; only the owner can.
  assert.equal((await request(`/api/admin/sellers/${seller.id}/trust`, { cookie: seller.cookie, body: { trusted: true } })).status, 401);
  assert.equal((await request(`/api/admin/sellers/${seller.id}/trust`, { token, body: { trusted: true } })).status, 200);
  assert.equal((await request(`/api/sellers/${seller.id}`)).body.seller.trusted, true);
  assert.equal((await request(`/api/listings/${id}`)).body.seller.trusted, true);
  assert.equal((await request('/api/admin/listings?status=published', { token })).body.listings.find((l) => l.id === id).seller_trusted, 1);
  await request(`/api/admin/sellers/${seller.id}/trust`, { token, body: { trusted: false } });
  assert.equal((await request(`/api/sellers/${seller.id}`)).body.seller.trusted, false);

  // The owner can delete a seller review.
  const reviewId = (await request('/api/admin/reviews', { token })).body.seller[0].id;
  assert.equal((await request(`/api/admin/seller-reviews/${reviewId}`, { token, method: 'DELETE' })).status, 200);
  assert.equal((await request(`/api/sellers/${seller.id}`)).body.seller.rating_count, 0);

  // Reviews of Vòng wait for approval before anyone sees them.
  assert.equal((await request('/api/site-reviews', { body: { rating: 5, body: 'Web dễ dùng quá' } })).status, 401);
  assert.equal((await request('/api/site-reviews', { cookie: buyer.cookie, body: { rating: 5, body: 'Web dễ dùng quá' } })).status, 201);
  let site = (await request('/api/site-reviews', { cookie: buyer.cookie })).body;
  assert.equal(site.count, 0, 'not public before approval');
  assert.equal(site.mine.status, 'pending');
  const admin1 = (await request('/api/admin/reviews', { token })).body;
  assert.equal(admin1.pending, 1);
  assert.equal((await request(`/api/admin/site-reviews/${admin1.site[0].id}/approve`, { token, method: 'POST' })).status, 200);
  site = (await request('/api/site-reviews')).body;
  assert.equal(site.count, 1);
  assert.equal(site.average, 5);
  assert.equal(site.reviews[0].reviewer, 'Nguyễn B.');
  // Editing sends it back for approval; hiding takes it off the page.
  await request('/api/site-reviews', { cookie: buyer.cookie, body: { rating: 4, body: 'Web dễ dùng, mong có app' } });
  assert.equal((await request('/api/site-reviews')).body.count, 0);
  await request(`/api/admin/site-reviews/${admin1.site[0].id}/hide`, { token, method: 'POST' });
  assert.equal((await request('/api/site-reviews')).body.count, 0);

  console.log('review tests passed');
} finally {
  server.close();
  fs.rmSync(directory, { recursive: true, force: true });
}
