import http from 'node:http';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

// A stand-in for the Resend API that records what the app tries to send.
const sent = [];
const fake = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => { sent.push(JSON.parse(body)); res.end('{}'); });
});
await new Promise((r) => fake.listen(0, '127.0.0.1', r));

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vong-email-'));
process.env.DATABASE_FILE = path.join(directory, 'test.db');
process.env.UPLOADS_DIR = path.join(directory, 'uploads');
process.env.GOOGLE_CLIENT_ID = 'test-client';
process.env.ADMIN_PASSWORD = 'test-admin-pass';
process.env.RESEND_API_KEY = 're_test';
process.env.RESEND_API_URL = `http://127.0.0.1:${fake.address().port}`;
process.env.MAIL_FROM = 'Vòng <hello@example.test>';
const { createAuthRouter, sessionUser, protectWrites } = await import('./accounts.js');
const { router: conversations } = await import('./routes/conversations.js');
const { router: listings } = await import('./routes/listings.js');
const { router: admin } = await import('./routes/admin.js');
const app = express();
app.use(express.json(), protectWrites, sessionUser);
app.use('/api/auth', createAuthRouter(async (credential) => ({ sub: credential, email: `${credential}@example.test`, name: credential, email_verified: true })));
app.use('/api/conversations', conversations);
app.use('/api/listings', listings);
app.use('/api/admin', admin);
const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function request(url, { cookie, token, body, method = body ? 'POST' : 'GET' } = {}) {
  const response = await fetch(base + url, { method, headers: { 'X-Vong-Request': '1', ...(cookie ? { Cookie: cookie } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie') };
}

try {
  const seller = await request('/api/auth/google', { body: { credential: 'seller' } });
  const buyer = await request('/api/auth/google', { body: { credential: 'buyer' } });
  const admin_ = await request('/api/admin/login', { body: { password: 'test-admin-pass' } });
  const token = admin_.body.token;
  assert.ok(token, 'admin can sign in');

  const listing = { title: 'Email flow chair', description: 'A test listing used to check that emails go out at the right moments.', category: 'furniture', price_vnd: 120000, district: 'district_3', condition: 'good', seller_name: 'Seller', seller_phone: '0900000000' };
  const a = await request('/api/listings', { cookie: seller.cookie, body: listing });
  const b = await request('/api/listings', { cookie: seller.cookie, body: { ...listing, title: 'Email flow desk' } });
  assert.equal(sent.length, 0, 'creating a listing sends no email');

  // Approve: the seller hears about it, at their account email.
  assert.equal((await request(`/api/admin/listings/${a.body.id}/approve`, { token, method: 'POST', body: {} })).status, 200);
  await wait(300);
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].to, ['seller@example.test']);
  assert.match(sent[0].subject, /Email flow chair/);

  // Reject: the reason reaches the seller.
  assert.equal((await request(`/api/admin/listings/${b.body.id}/reject`, { token, body: { reason: 'Photo is too dark to see the desk' } })).status, 200);
  await wait(300);
  assert.equal(sent.length, 2);
  assert.match(sent[1].text, /Photo is too dark to see the desk/);

  // A wrong-status approve must not email again.
  assert.equal((await request(`/api/admin/listings/${b.body.id}/approve`, { token, body: {} })).status, 409);
  await wait(200);
  assert.equal(sent.length, 2);

  // Chat: buyer writes, seller gets one email; follow-ups inside the cooldown stay quiet.
  const conv = (await request('/api/conversations', { cookie: buyer.cookie, body: { listingId: a.body.id } })).body.conversation;
  const send = (cookie, body, clientId) => request(`/api/conversations/${conv.id}/messages`, { cookie, body: { body, clientId } });
  assert.equal((await send(buyer.cookie, 'Is it still available?', 'client-0001')).status, 201);
  await wait(300);
  assert.equal(sent.length, 3);
  assert.deepEqual(sent[2].to, ['seller@example.test']);
  assert.match(sent[2].text, /Is it still available\?/);
  assert.doesNotMatch(sent[2].text + sent[2].html, /0900000000/, 'no phone number in email');

  assert.equal((await send(buyer.cookie, 'Hello?', 'client-0002')).status, 201);
  assert.equal((await send(buyer.cookie, 'Is it still available?', 'client-0001')).status, 201); // retry of the first
  await wait(300);
  assert.equal(sent.length, 3, 'no flood inside the cooldown, and a retry never re-sends');

  // The other direction has its own cooldown: the buyer is emailed on the seller's reply.
  assert.equal((await send(seller.cookie, 'Yes, come by tomorrow.', 'client-0003')).status, 201);
  await wait(300);
  assert.equal(sent.length, 4);
  assert.deepEqual(sent[3].to, ['buyer@example.test']);

  console.log('email flow tests passed');
} finally {
  server.close();
  fake.close();
}
