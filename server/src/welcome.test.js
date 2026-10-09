import http from 'node:http';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

// A stand-in for Resend that records what the app sends.
const sent = [];
const fake = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => { sent.push(JSON.parse(body)); res.end('{}'); });
});
await new Promise((r) => fake.listen(0, '127.0.0.1', r));

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vong-welcome-'));
process.env.DATABASE_FILE = path.join(directory, 'test.db');
process.env.UPLOADS_DIR = path.join(directory, 'uploads');
process.env.GOOGLE_CLIENT_ID = 'test-client';
process.env.RESEND_API_URL = `http://127.0.0.1:${fake.address().port}`;
process.env.MAIL_FROM = 'Vòng <hello@example.test>';
process.env.PUBLIC_URL = 'https://example.test';
delete process.env.RESEND_API_KEY;

const { db } = await import('./db.js');
const { createAuthRouter, protectWrites, sessionUser } = await import('./accounts.js');
const { buildEmail } = await import('./mailer.js');
const app = express();
app.use(express.json(), protectWrites, sessionUser);
app.use('/api/auth', createAuthRouter(async (credential) => ({ sub: credential, email: `${credential}@example.test`, name: credential === 'linh' ? 'Linh <b>Nguyễn</b>' : credential, email_verified: true })));
const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const signIn = (credential) => fetch(`${base}/api/auth/google`, { method: 'POST', headers: { 'X-Vong-Request': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ credential }) });

try {
  // Mail off: signing up works and sends nothing.
  assert.equal((await signIn('quiet')).status, 200);
  await wait(200);
  assert.equal(sent.length, 0);

  process.env.RESEND_API_KEY = 're_test';

  // An account that existed before (here: created while mail was off) gets nothing on its next sign-in.
  assert.equal((await signIn('quiet')).status, 200);
  await wait(200);
  assert.equal(sent.length, 0, 'existing accounts are not welcomed');

  // A new sign-up gets exactly one welcome email, to their Google address.
  assert.equal((await signIn('linh')).status, 200);
  await wait(300);
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].to, ['linh@example.test']);
  assert.match(sent[0].subject, /Chào mừng bạn đến với Vòng/);
  assert.match(sent[0].text, /Món đầu tiên bạn đăng bán là miễn phí/);
  assert.match(sent[0].text, /https:\/\/example\.test\/sell/);
  assert.match(sent[0].html, /Linh &lt;b&gt;Nguyễn&lt;\/b&gt;/, 'name is escaped');
  assert.doesNotMatch(sent[0].html, /<b>Nguyễn<\/b>/);

  // Signing in again (new session, new device) sends nothing more.
  assert.equal((await signIn('linh')).status, 200);
  assert.equal((await signIn('linh')).status, 200);
  await wait(300);
  assert.equal(sent.length, 1, 'only one welcome per account');
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM users WHERE google_sub = 'linh'").get().n, 1);

  // A rejected sign-in (bad credential) never emails.
  const bad = await fetch(`${base}/api/auth/google`, { method: 'POST', headers: { 'X-Vong-Request': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
  assert.equal(bad.status, 400);

  // Template copes with no name.
  assert.match(buildEmail('welcome', {}).text, /^Chào bạn,/);

  console.log('welcome email tests passed');
} finally {
  server.close();
  fake.close();
}
