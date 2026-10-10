import http from 'node:http';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

const sent = [];
const fake = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => { sent.push(JSON.parse(body)); res.end('{}'); });
});
await new Promise((r) => fake.listen(0, '127.0.0.1', r));

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vong-pay-'));
process.env.DATABASE_FILE = path.join(directory, 'test.db');
process.env.UPLOADS_DIR = path.join(directory, 'uploads');
process.env.GOOGLE_CLIENT_ID = 'test-client';
process.env.RESEND_API_KEY = 're_test';
process.env.RESEND_API_URL = `http://127.0.0.1:${fake.address().port}`;
process.env.MAIL_FROM = 'Vòng <hello@example.test>';
delete process.env.SEPAY_API_KEY;
delete process.env.PAYMENT_AUTO_PUBLISH;
delete process.env.SEPAY_ACCOUNT_NUMBER;

const { db } = await import('./db.js');
const { createAuthRouter, sessionUser, protectWrites } = await import('./accounts.js');
const { router: listings } = await import('./routes/listings.js');
const { router: payments } = await import('./routes/payments.js');
const { findRefs } = await import('./payments.js');

// Same order as index.js: the webhook sits before the browser-origin check.
const app = express();
app.use(express.json());
app.use('/api/payments', payments);
app.use(protectWrites, sessionUser);
app.use('/api/auth', createAuthRouter(async (credential) => ({ sub: credential, email: `${credential}@example.test`, name: credential, email_verified: true })));
app.use('/api/listings', listings);
const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const KEY = 'sepay-test-key-0123456789';

async function api(url, { cookie, body, headers = {} } = {}) {
  const r = await fetch(base + url, { method: body ? 'POST' : 'GET', headers: { 'X-Vong-Request': '1', ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json() };
}
let txn = 1000;
const hook = (payload, key = KEY) => api('/api/payments/sepay', { body: { id: ++txn, transferType: 'in', transferAmount: 10000, accountNumber: '0011223344', content: '', ...payload }, headers: key ? { Authorization: `Apikey ${key}` } : {} });
const row = (id) => db.prepare('SELECT status, payment_verified_at, paid_marked_at, published_at FROM listings WHERE id = ?').get(id);

try {
  // ref matching survives what banks do to a note
  assert.deepEqual(findRefs('NGUYEN VAN A chuyen tien VONG-A2B3C4'), ['VONG-A2B3C4']);
  assert.deepEqual(findRefs('vong a2b3c4 thanh toan'), ['VONG-A2B3C4']);
  assert.deepEqual(findRefs('VONGA2B3C4'), ['VONG-A2B3C4']);
  assert.deepEqual(findRefs('Thanh toán VONG-K7M2PQ cảm ơn'), ['VONG-K7M2PQ']);
  assert.deepEqual(findRefs('no reference here'), []);
  // VietinBank via SePay: the note starts with the SEVQR keyword.
  assert.deepEqual(findRefs('SEVQR VONG-A2B3C4'), ['VONG-A2B3C4']);

  const login = await (await fetch(`${base}/api/auth/google`, { method: 'POST', headers: { 'X-Vong-Request': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: 'seller' }) })).headers.get('set-cookie');
  // The new seller was welcomed; the payment emails below count from zero.
  await wait(300);
  assert.equal(sent.length, 1);
  assert.match(sent[0].subject, /Welcome to Vòng/);
  sent.length = 0;
  const listing = { title: 'Payment test chair', description: 'A test listing used to check automatic payment matching works properly.', category: 'furniture', price_vnd: 120000, district: 'district_3', condition: 'good', seller_name: 'Seller', seller_phone: '0900000000' };
  const make = async (title) => (await api('/api/listings', { cookie: login, body: { ...listing, title } })).body;
  await make('free first');                 // first listing is free: nothing to pay
  const a = await make('Payment test A');   // pending_payment, fee 10000
  const b = await make('Payment test B');
  const c = await make('Payment test C');
  const d = await make('Payment test D');
  assert.equal(a.status, 'pending_payment');
  assert.equal(a.fee_vnd, 10000);

  // off without a key, closed with a wrong one
  assert.equal((await hook({})).status, 404);
  process.env.SEPAY_API_KEY = KEY;
  assert.equal((await hook({}, null)).status, 401);
  assert.equal((await hook({}, 'wrong-key-wrong-key-1234')).status, 401);
  assert.equal((await api('/api/payments/sepay', { body: {}, headers: { Authorization: 'Bearer ' + KEY } })).status, 401);

  // outgoing money and other accounts are ignored
  assert.deepEqual((await hook({ transferType: 'out', content: a.ref })).body, { success: true });
  process.env.SEPAY_ACCOUNT_NUMBER = '9999999999';
  await hook({ content: a.ref });
  delete process.env.SEPAY_ACCOUNT_NUMBER;
  assert.equal(row(a.id).status, 'pending_payment');

  // too small: flagged, not confirmed
  await hook({ content: `chuyen tien ${a.ref}`, transferAmount: 5000 });
  assert.equal(row(a.id).status, 'pending_payment');

  // unmatched note: recorded, nothing changes, still answers success
  assert.deepEqual((await hook({ content: 'ung ho ban hang' })).body, { success: true });
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM bank_transactions WHERE outcome = 'no_match'").get().n, 1);

  // the real payment: lands in the review queue and the seller is emailed
  const paid = { id: 5001, content: `NGUYEN VAN A chuyen tien ${a.ref.replace('-', ' ')}` };
  assert.equal((await hook(paid)).status, 200);
  await wait(300);
  assert.equal(row(a.id).status, 'awaiting_approval');
  assert.ok(row(a.id).payment_verified_at, 'payment is marked verified');
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].to, ['seller@example.test']);
  assert.match(sent[0].subject, /Payment received/);

  // SePay retries the same transaction: nothing happens twice
  await hook(paid);
  await wait(200);
  assert.equal(sent.length, 1, 'a retried webhook sends no second email');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM bank_transactions WHERE txn_id = ?').get('5001').n, 1);

  // a second, different transfer for the same listing is flagged as a duplicate payment
  await hook({ content: a.ref });
  assert.equal(db.prepare("SELECT outcome FROM bank_transactions WHERE listing_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1").get(a.id).outcome, 'already_paid');
  assert.equal(row(a.id).status, 'awaiting_approval');
  assert.equal(sent.length, 1);

  // seller clicked "I paid" first, then the money arrives: still verified once
  assert.equal((await api(`/api/listings/${b.id}/mark-paid`, { cookie: login, body: {} })).status, 200);
  assert.equal(row(b.id).payment_verified_at, null);
  await hook({ content: b.ref, transferAmount: 12000 }); // overpaying is fine
  assert.ok(row(b.id).payment_verified_at);
  assert.equal(row(b.id).status, 'awaiting_approval');

  // The payment page shows the note with the SEVQR keyword, and the QR code carries it.
  const pay = (await api(`/api/listings/${c.id}/payment`, { cookie: login })).body.payment;
  assert.equal(pay.reference, `SEVQR ${c.ref}`);
  assert.ok(pay.qr_payload.includes(`08${String(`SEVQR ${c.ref}`.length).padStart(2, '0')}SEVQR ${c.ref}`), 'QR note starts with SEVQR');

  // auto-publish switch: money in (note exactly as the bank sends it), listing live, "approved" email
  process.env.PAYMENT_AUTO_PUBLISH = 'true';
  sent.length = 0;
  await hook({ content: `SEVQR ${c.ref}` });
  await wait(300);
  assert.equal(row(c.id).status, 'published');
  assert.ok(row(c.id).published_at);
  assert.match(sent.at(-1).subject, /đã lên sàn|live/i);
  delete process.env.PAYMENT_AUTO_PUBLISH;

  // a listing nobody paid for stays untouched
  assert.equal(row(d.id).status, 'pending_payment');
  console.log('payments tests passed');
} finally {
  server.close();
  fake.close();
}
