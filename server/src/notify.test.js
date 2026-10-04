import http from 'node:http';
import assert from 'node:assert/strict';
import { notifyOwner } from './notify.js';

const got = [];
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => { got.push(JSON.parse(body)); res.end('{}'); });
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

delete process.env.NTFY_TOPIC;
notifyOwner({ title: 't', message: 'm' });
await new Promise((r) => setTimeout(r, 150));
assert.equal(got.length, 0, 'does nothing when NTFY_TOPIC is unset');

process.env.NTFY_TOPIC = 'secret-topic';
process.env.NTFY_SERVER = `http://127.0.0.1:${port}`;
process.env.PUBLIC_URL = 'https://example.test/';
notifyOwner({ title: 'Món mới', message: 'Ghế gỗ', tags: ['bell'] });
await new Promise((r) => setTimeout(r, 300));
assert.equal(got.length, 1);
assert.equal(got[0].topic, 'secret-topic');
assert.equal(got[0].title, 'Món mới');
assert.equal(got[0].click, 'https://example.test/admin');

process.env.NTFY_SERVER = 'http://127.0.0.1:1';
notifyOwner({ title: 'x', message: 'y' }); // unreachable: must not throw
await new Promise((r) => setTimeout(r, 300));

server.close();
console.log('notify tests passed');
