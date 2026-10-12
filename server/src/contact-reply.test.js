import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import express from 'express';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vong-reply-'));
process.env.DATABASE_FILE = path.join(directory, 'test.db');
process.env.UPLOADS_DIR = path.join(directory, 'uploads');
process.env.ADMIN_PASSWORD = 'test-admin-pass';
process.env.MAIL_FROM = 'Vòng <hello@usevong.com>';
delete process.env.CONTACT_INBOX;
delete process.env.MAIL_REPLY_TO;

// A stand-in for Resend that records what would have been sent.
const sent = [];
let resendOk = true;
const resend = await new Promise((resolve) => {
  const s = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => { sent.push(JSON.parse(raw)); res.writeHead(resendOk ? 200 : 500, { 'Content-Type': 'application/json' }); res.end('{"id":"x"}'); });
  }).listen(0, '127.0.0.1', () => resolve(s));
});
process.env.RESEND_API_URL = `http://127.0.0.1:${resend.address().port}`;

const { db } = await import('./db.js');
const { router: admin } = await import('./routes/admin.js');
const app = express();
app.use(express.json());
app.use('/api/admin', admin);
const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;
const call = async (url, { token, body, method = body ? 'POST' : 'GET' } = {}) => {
  const r = await fetch(base + url, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json() };
};

try {
  const token = (await call('/api/admin/login', { body: { password: 'test-admin-pass' } })).body.token;
  const { lastInsertRowid: id } = db.prepare('INSERT INTO messages (name, email, body, created_at) VALUES (?, ?, ?, ?)')
    .run('Thịnh', 'thinh@example.test', 'Các bạn làm rất tốt!\nCần người support thì có mình.', '2026-10-11T08:30:00.000Z');

  // Only the owner can reply; bad input and unknown messages are refused.
  assert.equal((await call(`/api/admin/messages/${id}/reply`, { body: { body: 'Cảm ơn bạn!' } })).status, 401);
  assert.equal((await call(`/api/admin/messages/${id}/reply`, { token, body: { body: ' ' } })).status, 400);
  assert.equal((await call('/api/admin/messages/999/reply', { token, body: { body: 'Cảm ơn bạn!' } })).status, 404);

  // Without email set up, nothing is sent and nothing is marked replied.
  delete process.env.RESEND_API_KEY;
  assert.equal((await call(`/api/admin/messages/${id}/reply`, { token, body: { body: 'Cảm ơn bạn!' } })).body.error, 'mail_off');
  process.env.RESEND_API_KEY = 're_test';

  // A failed send is reported and not recorded.
  resendOk = false;
  assert.equal((await call(`/api/admin/messages/${id}/reply`, { token, body: { body: 'Cảm ơn bạn!' } })).status, 502);
  assert.equal(db.prepare('SELECT replied_at FROM messages WHERE id = ?').get(id).replied_at, null);
  resendOk = true;
  sent.length = 0;

  // The reply goes out from hello@usevong.com; answers and a copy go to the shared inbox.
  const reply = 'Chào Thịnh,\n\nCảm ơn bạn nhiều lắm!';
  const ok = await call(`/api/admin/messages/${id}/reply`, { token, body: { body: reply } });
  assert.equal(ok.status, 200);
  assert.equal(sent.length, 1);
  const mail = sent[0];
  assert.deepEqual(mail.to, ['thinh@example.test']);
  assert.equal(mail.from, 'Vòng <hello@usevong.com>');
  assert.equal(mail.reply_to, 'vong-inquiries@outlook.com');
  assert.deepEqual(mail.bcc, ['vong-inquiries@outlook.com']);
  assert.ok(mail.text.startsWith(reply), 'reply comes first');
  assert.match(mail.text, /> Các bạn làm rất tốt!/, 'original is quoted');
  assert.match(mail.html, /Cần người support/);
  assert.ok(!mail.html.includes('<script'), 'html is escaped');

  // The admin list shows when it came in and the reply.
  const listed = (await call('/api/admin/messages', { token })).body.messages.find((m) => m.id === Number(id));
  assert.equal(listed.created_at, '2026-10-11T08:30:00.000Z');
  assert.equal(listed.reply_body, reply);
  assert.ok(listed.replied_at);
  console.log('contact reply tests passed');
} finally {
  server.close();
  resend.close();
  fs.rmSync(directory, { recursive: true, force: true });
}
