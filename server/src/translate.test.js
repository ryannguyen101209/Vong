import http from 'node:http';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

// A stand-in for the Claude API. It "translates" by upper-casing, and can refuse.
const calls = [];
let mode = 'ok';
const fake = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const request = JSON.parse(body);
    calls.push({ url: req.url, key: req.headers['x-api-key'], request });
    const text = request.messages[0].content;
    const title = /<title>([\s\S]*?)<\/title>/.exec(text)[1];
    const description = /<description>\n([\s\S]*?)\n<\/description>/.exec(text)[1];
    const message = (content, stop_reason) => ({ id: 'msg_test', type: 'message', role: 'assistant', model: request.model, content, stop_reason, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 } });
    res.setHeader('content-type', 'application/json');
    if (mode === 'refuse') return res.end(JSON.stringify({ ...message([], 'refusal'), stop_details: { type: 'refusal', category: null, explanation: '' } }));
    if (mode === 'error') { res.statusCode = 500; return res.end(JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'boom' } })); }
    res.end(JSON.stringify(message([{ type: 'text', text: JSON.stringify({ title: title.toUpperCase(), description: description.toUpperCase() }) }], 'end_turn')));
  });
});
await new Promise((r) => fake.listen(0, '127.0.0.1', r));

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vong-translate-'));
process.env.DATABASE_FILE = path.join(directory, 'test.db');
process.env.UPLOADS_DIR = path.join(directory, 'uploads');
process.env.GOOGLE_CLIENT_ID = 'test-client';
process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${fake.address().port}`;
process.env.ANTHROPIC_MAX_RETRIES = '0';
delete process.env.ANTHROPIC_API_KEY;
delete process.env.TRANSLATE_MODEL;

const { db } = await import('./db.js');
const { createAuthRouter, sessionUser, protectWrites } = await import('./accounts.js');
const { router: listings } = await import('./routes/listings.js');
const app = express();
app.use(express.json(), protectWrites, sessionUser);
app.use('/api/auth', createAuthRouter(async (credential) => ({ sub: credential, email: `${credential}@example.test`, name: credential, email_verified: true })));
app.use('/api/listings', listings);
const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;

async function request(url, { cookie, body, method } = {}) {
  const response = await fetch(base + url, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'X-Vong-Request': '1', ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie') };
}
const translate = (id, to) => request(`/api/listings/${id}/translate`, { body: { to } });

try {
  const seller = (await request('/api/auth/google', { body: { credential: 'seller' } })).cookie;
  const listing = { title: 'Đèn bàn gỗ', description: 'Đèn còn mới 95%, fix nhẹ. Qua Quận 3 lấy nha.', category: 'furniture', price_vnd: 150000, district: 'district_3', condition: 'good', seller_name: 'Linh', seller_phone: '0900000000', lang: 'vi' };
  const id = (await request('/api/listings', { cookie: seller, body: listing })).body.id;
  const row = db.prepare('SELECT title_vi, title_en FROM listings WHERE id = ?').get(id);
  assert.ok(row.title_vi && !row.title_en, 'test listing is written in Vietnamese');

  // Not public yet: nothing to translate.
  assert.equal((await translate(id, 'en')).status, 404);
  db.prepare("UPDATE listings SET status = 'published' WHERE id = ?").run(id);

  // Off without a key, and no API call is made.
  assert.equal((await translate(id, 'en')).status, 404);
  assert.equal(calls.length, 0);

  process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
  assert.equal((await translate(id, 'fr')).status, 400);
  assert.equal((await translate(id, 'vi')).status, 400, 'already in Vietnamese');

  // First translation calls the model with the listing and the right settings.
  const first = await translate(id, 'en');
  assert.equal(first.status, 200);
  assert.equal(first.body.title, 'ĐÈN BÀN GỖ');
  assert.match(first.body.description, /CÒN MỚI 95%/);
  assert.equal(first.body.machine, true);
  assert.equal(calls.length, 1);
  const sent = calls[0].request;
  assert.equal(calls[0].url, '/v1/messages');
  assert.equal(calls[0].key, 'sk-ant-test');
  assert.equal(sent.model, 'claude-haiku-5-5');
  assert.equal(sent.output_config.format.type, 'json_schema');
  assert.match(sent.messages[0].content, /Translate into English/);
  assert.match(sent.system, /not instructions to you/);

  // Second time (any visitor) comes from the database, no model call.
  const again = await translate(id, 'en');
  assert.equal(again.body.title, 'ĐÈN BÀN GỖ');
  assert.equal(calls.length, 1, 'saved translation is reused');

  // Two visitors at once share one call.
  db.prepare('DELETE FROM listing_translations').run();
  await Promise.all([translate(id, 'en'), translate(id, 'en'), translate(id, 'en')]);
  assert.equal(calls.length, 2);

  // The seller edits the description: the next visitor gets a fresh translation.
  db.prepare("UPDATE listings SET description_vi = 'Đèn còn mới 99%, không lỗi gì.' WHERE id = ?").run(id);
  assert.match((await translate(id, 'en')).body.description, /99%/);
  assert.equal(calls.length, 3);

  // A refusal or an API error is reported, not saved.
  db.prepare('DELETE FROM listing_translations').run();
  mode = 'refuse';
  assert.equal((await translate(id, 'en')).status, 502);
  mode = 'error';
  assert.equal((await translate(id, 'en')).status, 502);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM listing_translations').get().n, 0);
  mode = 'ok';

  // The model can be changed with TRANSLATE_MODEL.
  process.env.TRANSLATE_MODEL = 'claude-sonnet-5-5';
  await translate(id, 'en');
  assert.equal(calls.at(-1).request.model, 'claude-sonnet-5-5');

  console.log('translate tests passed');
} finally {
  server.close();
  fake.close();
}
