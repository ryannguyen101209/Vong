import http from 'node:http';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import express from 'express';
import Database from 'better-sqlite3';

// A stand-in for Resend that records emails; it can be told to fail.
const sent = [];
let failNext = false;
const fake = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    if (failNext) { failNext = false; res.statusCode = 500; return res.end('{}'); }
    sent.push(JSON.parse(body)); res.end('{}');
  });
});
await new Promise((r) => fake.listen(0, '127.0.0.1', r));

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vong-backup-test-'));
process.env.DATABASE_FILE = path.join(directory, 'test.db');
process.env.UPLOADS_DIR = path.join(directory, 'uploads');
process.env.ADMIN_PASSWORD = 'test-admin-pass';
process.env.RESEND_API_KEY = 're_test';
process.env.RESEND_API_URL = `http://127.0.0.1:${fake.address().port}`;
process.env.MAIL_FROM = 'Vòng <hello@example.test>';
delete process.env.BACKUP_EMAIL;

const { db } = await import('./db.js');
const { router: admin } = await import('./routes/admin.js');
const { backupIfDue, emailBackup } = await import('./backup.js');
const app = express();
app.use(express.json());
app.use('/api/admin', admin);
const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;

const openGz = (buffer) => {
  const file = path.join(directory, `restore-${Math.random()}.db`);
  fs.writeFileSync(file, zlib.gunzipSync(buffer));
  return new Database(file, { readonly: true });
};

try {
  db.prepare("INSERT INTO users (id, google_sub, email, name, created_at) VALUES ('u1', 's1', 'seller@example.test', 'Backup Seller', '')").run();

  // Download needs the admin token.
  assert.equal((await fetch(`${base}/api/admin/backup`)).status, 401);
  const token = (await (await fetch(`${base}/api/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'test-admin-pass' }) })).json()).token;
  const download = await fetch(`${base}/api/admin/backup`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(download.status, 200);
  assert.match(download.headers.get('content-disposition'), /attachment; filename="vong-backup-\d{4}-\d{2}-\d{2}\.db\.gz"/);
  // The download restores into a working database with the data in it.
  const restored = openGz(Buffer.from(await download.arrayBuffer()));
  assert.equal(restored.prepare("SELECT name FROM users WHERE id = 'u1'").get().name, 'Backup Seller');
  assert.ok(restored.prepare("SELECT 1 FROM sqlite_master WHERE name = 'listings'").get());
  restored.close();

  // Daily email: off without BACKUP_EMAIL.
  assert.equal(await backupIfDue(), 'off');
  assert.equal((await fetch(`${base}/api/admin/backup/email`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })).status, 409);
  assert.equal(sent.length, 0);

  process.env.BACKUP_EMAIL = 'owner@example.test';
  const day0 = new Date('2026-10-08T03:00:00Z');
  assert.equal(await backupIfDue(day0), 'sent', 'first one goes out straight away');
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].to, ['owner@example.test']);
  assert.equal(sent[0].attachments[0].filename, 'vong-backup-2026-10-08.db.gz');
  const emailed = openGz(Buffer.from(sent[0].attachments[0].content, 'base64'));
  assert.equal(emailed.prepare('SELECT COUNT(*) AS n FROM users').get().n, 1);
  emailed.close();

  // Not again the same day (a restart or deploy must not resend), then again a day later.
  assert.equal(await backupIfDue(new Date(day0.getTime() + 6 * 3600e3)), 'not_due');
  assert.equal(sent.length, 1);
  assert.equal(await backupIfDue(new Date(day0.getTime() + 24 * 3600e3)), 'sent');
  assert.equal(sent.length, 2);

  // A failed send is logged and retried at the next hourly check.
  failNext = true;
  const day2 = new Date(day0.getTime() + 48 * 3600e3);
  assert.equal(await backupIfDue(day2), 'failed');
  assert.equal(await backupIfDue(new Date(day2.getTime() + 3600e3)), 'sent');
  assert.deepEqual(db.prepare('SELECT outcome FROM backup_log ORDER BY id').all().map((r) => r.outcome), ['sent', 'sent', 'failed', 'sent']);

  // The settings endpoint shows a masked address and the last send.
  const settings = await (await fetch(`${base}/api/admin/settings`, { headers: { Authorization: `Bearer ${token}` } })).json();
  assert.equal(settings.backup.email, 'o…@example.test');
  assert.ok(settings.backup.last_sent.created_at);

  // "Email one now" works from the admin panel.
  const now = await fetch(`${base}/api/admin/backup/email`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  assert.equal(now.status, 200);
  assert.equal((await now.json()).outcome, 'sent');
  assert.equal(await emailBackup(), 'sent');

  console.log('backup tests passed');
} finally {
  server.close();
  fake.close();
}
