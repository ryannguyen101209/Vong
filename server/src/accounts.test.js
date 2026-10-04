import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vong-accounts-'));
process.env.DATABASE_FILE = path.join(directory, 'test.db');
process.env.UPLOADS_DIR = path.join(directory, 'uploads');
process.env.GOOGLE_CLIENT_ID = 'test-client';
process.env.CORS_ORIGIN = 'http://localhost:5174';
const { db, isFirstListing } = await import('./db.js');
const { createAuthRouter, sessionUser, protectWrites } = await import('./accounts.js');
const { router: conversations } = await import('./routes/conversations.js');
const { router: listings } = await import('./routes/listings.js');
const app = express();
app.use(express.json(), protectWrites, sessionUser);
app.use('/api/auth', createAuthRouter(async (credential, audience) => {
  assert.equal(audience, 'test-client');
  if (!['seller', 'buyer', 'stranger'].includes(credential)) throw new Error('Invalid signature');
  return { sub: credential, email: `${credential}@example.test`, name: credential, email_verified: true };
}));
app.use('/api/conversations', conversations);
app.use('/api/listings', listings);
const server = await new Promise((resolve) => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
const base = `http://127.0.0.1:${server.address().port}`;

async function request(url, { cookie, body, method = body ? 'POST' : 'GET', headers = {} } = {}) {
  const response = await fetch(base + url, { method, headers: { 'X-Vong-Request': '1', ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie') };
}
try {
  assert.equal((await request('/api/conversations')).status, 401);
  assert.equal((await request('/api/auth/google', { body: { credential: 'forged-token' } })).status, 401);
  assert.equal((await request('/api/auth/google', { body: { credential: 'seller' }, headers: { Origin: 'https://attacker.example' } })).status, 403);
  assert.equal((await request('/api/auth/google', { body: { credential: 'seller' }, headers: { 'X-Vong-Request': '' } })).status, 403);
  const seller = await request('/api/auth/google', { body: { credential: 'seller' } });
  const buyer = await request('/api/auth/google', { body: { credential: 'buyer' } });
  const stranger = await request('/api/auth/google', { body: { credential: 'stranger' } });
  assert.match(seller.cookie, /HttpOnly/);
  assert.match(seller.cookie, /SameSite=Lax/);
  assert.equal((await request('/api/auth/me', { cookie: seller.cookie })).body.profile.id, seller.body.profile.id);
  const listingBody = { title: 'Integration test chair', description: 'A test listing for checking account ownership and private messages.', category: 'furniture', price_vnd: 120000, district: 'district_3', condition: 'good', seller_name: 'Seller', seller_phone: '0900000000', seller_email: 'spoof@example.test', seller_id: stranger.body.profile.id };
  assert.equal((await request('/api/listings', { body: listingBody })).status, 401);
  const created = await request('/api/listings', { cookie: seller.cookie, body: listingBody });
  assert.equal(created.status, 201);
  const listingId = created.body.id;
  // First listing on an account is free and goes straight to the review queue.
  assert.equal(created.body.free, true);
  assert.equal(created.body.fee_vnd, 0);
  assert.equal(created.body.status, 'awaiting_approval');
  const second = await request('/api/listings', { cookie: seller.cookie, body: listingBody });
  assert.equal(second.body.free, false);
  assert.equal(second.body.fee_vnd, 10000);
  assert.equal(second.body.status, 'pending_payment');
  assert.equal((await request(`/api/listings/${listingId}/payment`, { cookie: seller.cookie })).body.payment, null);
  assert.equal((await request(`/api/listings/${second.body.id}/payment`, { cookie: seller.cookie })).body.payment.amount_vnd, 10000);
  assert.equal(isFirstListing(seller.body.profile.id), false);
  assert.equal(isFirstListing(buyer.body.profile.id), true);
  assert.equal(isFirstListing(null), false);
  // Seller tools: list, edit, mark sold / relist, remove. Only the owner may use them.
  const mine = await request('/api/listings/mine', { cookie: seller.cookie });
  assert.equal(mine.body.listings.length, 2);
  assert.equal((await request('/api/listings/mine', { cookie: buyer.cookie })).body.listings.length, 0);
  assert.equal((await request('/api/listings/mine')).status, 401);
  assert.equal((await request(`/api/listings/${listingId}`, { cookie: buyer.cookie, method: 'PATCH', body: { price_vnd: 5000 } })).status, 404);
  assert.equal((await request(`/api/listings/${listingId}`, { cookie: seller.cookie, method: 'PATCH', body: { price_vnd: 5 } })).status, 400);
  assert.equal((await request(`/api/listings/${listingId}`, { cookie: seller.cookie, method: 'PATCH', body: { price_vnd: 99000, title: 'Edited test chair' } })).status, 200);
  const edited = db.prepare('SELECT title_en, price_vnd FROM listings WHERE id = ?').get(listingId);
  assert.equal(edited.title_en, 'Edited test chair');
  assert.equal(edited.price_vnd, 99000);
  assert.equal((await request(`/api/listings/${listingId}/sold`, { cookie: seller.cookie, body: {} })).status, 409); // not live yet
  assert.equal((await request(`/api/listings/${listingId}/sold`, { cookie: buyer.cookie, body: {} })).status, 404);
  const row = db.prepare('SELECT * FROM listings WHERE id = ?').get(listingId);
  assert.equal(row.seller_id, seller.body.profile.id);
  assert.equal(row.seller_email, 'seller@example.test');
  assert.equal((await request(`/api/listings/${listingId}`)).status, 404);
  assert.equal((await request(`/api/listings/${listingId}/payment`, { cookie: buyer.cookie })).status, 404);
  assert.equal((await request(`/api/listings/${listingId}/mark-paid`, { cookie: buyer.cookie, body: {} })).status, 404);
  assert.equal((await request(`/api/listings/${listingId}/payment`, { cookie: seller.cookie })).status, 200);
  db.prepare("UPDATE listings SET status = 'published' WHERE id = ?").run(listingId);
  assert.equal((await request(`/api/listings/${listingId}/sold`, { cookie: seller.cookie, body: {} })).body.status, 'sold');
  assert.equal((await request(`/api/listings/${listingId}`, { cookie: buyer.cookie })).body.listing.status, 'sold'); // old links still work
  assert.equal((await request('/api/listings')).body.listings.some((l) => l.id === listingId), false); // but it leaves Browse
  assert.equal((await request(`/api/listings/${listingId}/relist`, { cookie: seller.cookie, body: {} })).body.status, 'published');
  assert.equal((await request(`/api/listings/${second.body.id}`, { cookie: buyer.cookie, method: 'DELETE' })).status, 404);
  assert.equal((await request(`/api/listings/${second.body.id}`, { cookie: seller.cookie, method: 'DELETE' })).body.status, 'removed');
  assert.equal((await request(`/api/listings/${second.body.id}`, { cookie: seller.cookie })).status, 404);
  assert.equal((await request('/api/listings/mine', { cookie: seller.cookie })).body.listings.length, 1);
  assert.equal((await request('/api/conversations', { cookie: seller.cookie, body: { listingId } })).status, 409);
  const started = await request('/api/conversations', { cookie: buyer.cookie, body: { listingId } });
  assert.equal(started.status, 200);
  const id = started.body.conversation.id;
  assert.equal((await request('/api/conversations', { cookie: buyer.cookie, body: { listingId } })).body.conversation.id, id);
  assert.equal((await request('/api/conversations', { cookie: stranger.cookie })).body.conversations.length, 0);
  assert.equal((await request(`/api/conversations/${id}/messages`, { cookie: stranger.cookie })).status, 404);
  assert.equal((await request(`/api/conversations/${id}/messages`, { cookie: stranger.cookie, body: { body: 'Intrusion', clientId: 'test-intrusion' } })).status, 404);
  const sent = await request(`/api/conversations/${id}/messages`, { cookie: buyer.cookie, body: { body: 'Is this available?', clientId: 'buyer-message-1', sender_id: seller.body.profile.id } });
  assert.equal(sent.status, 201);
  assert.equal(sent.body.message.sender_id, buyer.body.profile.id);
  const retried = await request(`/api/conversations/${id}/messages`, { cookie: buyer.cookie, body: { body: 'Is this available?', clientId: 'buyer-message-1' } });
  assert.equal(retried.body.message.id, sent.body.message.id);
  assert.equal((await request(`/api/conversations/${id}/messages`, { cookie: seller.cookie })).body.messages[0].body, 'Is this available?');
  assert.equal((await request(`/api/conversations/${id}/messages`, { cookie: seller.cookie, body: { body: 'Yes, it is.', clientId: 'seller-message-1' } })).status, 201);
  assert.equal((await request(`/api/conversations/${id}/messages?after=${sent.body.message.id}`, { cookie: buyer.cookie })).body.messages.length, 1);
  assert.equal((await request(`/api/conversations/${id}/messages`, { cookie: buyer.cookie, body: { body: 'a'.repeat(2001), clientId: 'oversize-test' } })).status, 400);
  assert.equal((await request(`/api/conversations/${id}/messages?before=bad`, { cookie: buyer.cookie })).status, 400);
  const insert = db.prepare('INSERT INTO chat_messages(conversation_id, sender_id, body, client_id, created_at) VALUES (?, ?, ?, ?, ?)');
  for (let i = 0; i < 105; i++) insert.run(id, seller.body.profile.id, `Message ${i}`, `pagination-${i}`, new Date().toISOString());
  const latest = await request(`/api/conversations/${id}/messages`, { cookie: buyer.cookie });
  assert.equal(latest.body.messages.length, 100);
  assert.equal(latest.body.hasMore, true);
  const earlier = await request(`/api/conversations/${id}/messages?before=${latest.body.messages[0].id}`, { cookie: buyer.cookie });
  assert.equal(earlier.body.messages.length, 7);
  assert.equal(earlier.body.hasMore, false);
  db.prepare('UPDATE listings SET is_seed = 1 WHERE id = ?').run(listingId);
  assert.equal((await request('/api/listings')).body.listings.length, 0);
  assert.equal((await request(`/api/listings/${listingId}`)).status, 404);
  await request('/api/auth/logout', { cookie: buyer.cookie, body: {} });
  assert.equal((await request('/api/conversations', { cookie: buyer.cookie })).status, 401);
  process.env.NODE_ENV = 'production';
  const secureLogin = await request('/api/auth/google', { body: { credential: 'seller' } });
  assert.match(secureLogin.cookie, /Secure/);
  db.prepare('UPDATE user_sessions SET expires_at = 0').run();
  assert.equal((await request('/api/conversations', { cookie: secureLogin.cookie })).status, 401);
  console.log('accounts/messaging: passed authentication, origin protection, ownership, conversation isolation, two-way delivery, retry deduplication, pagination, seed exclusion, logout and expiry tests.');
} finally {
  await new Promise((resolve) => server.close(resolve));
  db.close();
  fs.rmSync(directory, { recursive: true, force: true });
}
