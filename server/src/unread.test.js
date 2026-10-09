import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vong-unread-'));
process.env.DATABASE_FILE = path.join(directory, 'test.db');
process.env.UPLOADS_DIR = path.join(directory, 'uploads');
process.env.GOOGLE_CLIENT_ID = 'test-client';
delete process.env.RESEND_API_KEY;
const { db } = await import('./db.js');
const { createAuthRouter, sessionUser, protectWrites } = await import('./accounts.js');
const { router: conversations } = await import('./routes/conversations.js');
const { router: listings } = await import('./routes/listings.js');
const app = express();
app.use(express.json(), protectWrites, sessionUser);
app.use('/api/auth', createAuthRouter(async (credential) => ({ sub: credential, email: `${credential}@example.test`, name: credential, email_verified: true })));
app.use('/api/conversations', conversations);
app.use('/api/listings', listings);
const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;

async function request(url, { cookie, body } = {}) {
  const response = await fetch(base + url, { method: body ? 'POST' : 'GET', headers: { 'X-Vong-Request': '1', ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie') };
}

try {
  const seller = (await request('/api/auth/google', { body: { credential: 'seller' } })).cookie;
  const buyer = (await request('/api/auth/google', { body: { credential: 'buyer' } })).cookie;
  const other = (await request('/api/auth/google', { body: { credential: 'other' } })).cookie;
  const listing = { title: 'Unread test lamp', description: 'A test listing used to check unread message counts.', category: 'furniture', price_vnd: 90000, district: 'district_1', condition: 'good', seller_name: 'Seller', seller_phone: '0900000000' };
  const id = (await request('/api/listings', { cookie: seller, body: listing })).body.id;
  db.prepare("UPDATE listings SET status = 'published' WHERE id = ?").run(id);

  const unread = async (cookie) => (await request('/api/conversations/unread', { cookie })).body.count;
  const inbox = async (cookie) => (await request('/api/conversations', { cookie })).body.conversations;
  let n = 0;
  const send = (cookie, conv, text) => request(`/api/conversations/${conv}/messages`, { cookie, body: { body: text, clientId: `client-${String(++n).padStart(4, '0')}` } });

  assert.equal((await request('/api/conversations/unread')).status, 401, 'needs sign-in');
  const conv = (await request('/api/conversations', { cookie: buyer, body: { listingId: id } })).body.conversation.id;
  assert.equal(await unread(seller), 0);

  // Buyer writes twice: the seller has one conversation with 2 unread; the buyer's own messages never count.
  await send(buyer, conv, 'Is it still available?');
  await send(buyer, conv, 'I can pick it up today.');
  assert.equal(await unread(seller), 1);
  assert.equal((await inbox(seller))[0].unread, 2);
  assert.equal(await unread(buyer), 0);
  assert.equal(await unread(other), 0, 'strangers see nothing');

  // Opening the conversation reads it.
  await request(`/api/conversations/${conv}/messages`, { cookie: seller });
  assert.equal(await unread(seller), 0);
  assert.equal((await inbox(seller))[0].unread, 0);

  // Seller replies: now the buyer has one. Polling with ?after= also marks read.
  const reply = (await send(seller, conv, 'Yes, come by at 5.')).body.message;
  assert.equal(await unread(buyer), 1);
  await request(`/api/conversations/${conv}/messages?after=${reply.id - 1}`, { cookie: buyer });
  assert.equal(await unread(buyer), 0);

  // Loading older history (?before=) does not mark newer messages read.
  await send(buyer, conv, 'Great, see you.');
  await request(`/api/conversations/${conv}/messages?before=${reply.id}`, { cookie: seller });
  assert.equal(await unread(seller), 1);

  // Another user cannot read (or mark read) someone else's conversation.
  assert.equal((await request(`/api/conversations/${conv}/messages`, { cookie: other })).status, 404);
  assert.equal(await unread(seller), 1);

  console.log('unread tests passed');
} finally {
  server.close();
}
