import http from 'node:http';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { buildEmail, sendMail, emailUser, claimMessageEmail, mailEnabled } from './mailer.js';

const got = [];
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => { got.push({ url: req.url, auth: req.headers.authorization, body: JSON.parse(body) }); res.end('{}'); });
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// off without a key
delete process.env.RESEND_API_KEY;
assert.equal(mailEnabled(), false);
sendMail({ to: 'a@b.test', subject: 's', html: 'h', text: 't' });
await wait(150);
assert.equal(got.length, 0, 'does nothing when RESEND_API_KEY is unset');

// sends the right request
process.env.RESEND_API_KEY = 're_test';
process.env.RESEND_API_URL = `http://127.0.0.1:${port}`;
process.env.MAIL_FROM = 'Vòng <hello@example.test>';
process.env.PUBLIC_URL = 'https://example.test/';
assert.equal(mailEnabled(), true);
emailUser('seller@example.test', 'listing_approved', { listingId: 'abc', titleEn: 'Teak chairs', titleVi: 'Ghế gỗ teak' });
await wait(300);
assert.equal(got.length, 1);
assert.equal(got[0].url, '/emails');
assert.equal(got[0].auth, 'Bearer re_test');
assert.deepEqual(got[0].body.to, ['seller@example.test']);
assert.equal(got[0].body.from, 'Vòng <hello@example.test>');
// The approval email nudges the seller to share the listing.
assert.ok(got[0].body.html.includes('facebook.com/sharer/sharer.php?u=' + encodeURIComponent('https://example.test/listing/abc')));
assert.match(got[0].body.subject, /Ghế gỗ teak/);
assert.match(got[0].body.text, /https:\/\/example\.test\/listing\/abc/);

// no recipient: nothing
emailUser('', 'listing_approved', {});
await wait(150);
assert.equal(got.length, 1);

// rejection carries the reason, escaped in html
const rej = buildEmail('listing_rejected', { listingId: 'x', titleEn: 'Desk', titleVi: 'Bàn', reason: 'Photo is <blurry> & dark' });
assert.match(rej.text, /Photo is <blurry> & dark/);
assert.match(rej.html, /Photo is &lt;blurry&gt; &amp; dark/);
assert.doesNotMatch(rej.html, /<blurry>/);

// message email: preview clipped, name escaped, no stray markup
const msg = buildEmail('new_message', { fromName: '<b>Linh</b>', titleEn: 'Lamp', titleVi: 'Đèn', body: 'x'.repeat(400) });
assert.doesNotMatch(msg.html, /<b>Linh<\/b>/);
assert.ok(msg.text.includes('x'.repeat(139) + '…'));
assert.ok(!msg.text.includes('x'.repeat(141)));
assert.throws(() => buildEmail('nope', {}));

// unreachable provider must not throw
process.env.RESEND_API_URL = 'http://127.0.0.1:1';
sendMail({ to: 'a@b.test', subject: 's', html: 'h', text: 't' });
await wait(300);

// throttle: one email per conversation+recipient per window
const db = new Database(':memory:');
assert.equal(claimMessageEmail(db, 'c1', 'u1', 1000, 600000), true);
assert.equal(claimMessageEmail(db, 'c1', 'u1', 1000 + 599999, 600000), false);
assert.equal(claimMessageEmail(db, 'c1', 'u2', 1000 + 5, 600000), true, 'other recipient is independent');
assert.equal(claimMessageEmail(db, 'c2', 'u1', 1000 + 5, 600000), true, 'other conversation is independent');
assert.equal(claimMessageEmail(db, 'c1', 'u1', 1000 + 600001, 600000), true, 'window reopens');

server.close();
console.log('mailer tests passed');
