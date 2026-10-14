import http from 'node:http';
import assert from 'node:assert/strict';
import { notifyOwner, lastNotify } from './notify.js';

const got = [];
let reply = { status: 200, body: '{}' };
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    got.push({ ...JSON.parse(body), auth: req.headers.authorization });
    res.statusCode = reply.status;
    res.end(reply.body);
  });
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

delete process.env.NTFY_TOPIC;
delete process.env.NTFY_TOKEN;
assert.deepEqual(await notifyOwner({ title: 't', message: 'm' }), { ok: false, status: 0, error: 'not_configured' });
assert.equal(got.length, 0, 'does nothing when NTFY_TOPIC is unset');

process.env.NTFY_TOPIC = 'secret-topic';
process.env.NTFY_SERVER = `http://127.0.0.1:${port}`;
process.env.PUBLIC_URL = 'https://example.test/';
const sent = await notifyOwner({ title: 'Món mới', message: 'Ghế gỗ', tags: ['bell'] });
assert.deepEqual(sent, { ok: true, status: 200, error: null });
assert.equal(got.length, 1);
assert.equal(got[0].topic, 'secret-topic');
assert.equal(got[0].title, 'Món mới');
assert.equal(got[0].click, 'https://example.test/admin');
assert.equal(got[0].auth, undefined, 'no token, no Authorization header');
assert.equal(lastNotify().ok, true);

// With an ntfy.sh account token, alerts are sent as that account.
process.env.NTFY_TOKEN = 'tk_test';
await notifyOwner({ title: 'x', message: 'y' });
assert.equal(got.at(-1).auth, 'Bearer tk_test');

// A refusal (e.g. ntfy.sh's rate limit) is reported and logged, never thrown, and the topic stays out of the log.
const logged = [];
const realError = console.error;
console.error = (...args) => logged.push(args.join(' '));
reply = { status: 429, body: JSON.stringify({ code: 42901, error: 'limit reached: too many requests' }) };
const refused = await notifyOwner({ title: 'Tin mới', message: 'm' });
assert.equal(refused.ok, false);
assert.equal(refused.status, 429);
assert.match(refused.error, /^rate_limited: limit reached/);
assert.equal(lastNotify().status, 429);
assert.match(logged.join('\n'), /\[ntfy\] alert "Tin mới" not delivered: rate_limited/);
assert.ok(!logged.join('\n').includes('secret-topic'), 'the topic is never logged');

reply = { status: 401, body: '{"error":"unauthorized"}' };
assert.match((await notifyOwner({ title: 'x', message: 'y' })).error, /^not_allowed/);

process.env.NTFY_SERVER = 'http://127.0.0.1:1';
assert.equal((await notifyOwner({ title: 'x', message: 'y' })).error, 'unreachable', 'unreachable: reported, not thrown');
console.error = realError;

server.close();
console.log('notify tests passed');
