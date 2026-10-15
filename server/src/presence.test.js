import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vong-presence-'));
process.env.DATABASE_FILE = path.join(directory, 'test.db');
process.env.UPLOADS_DIR = path.join(directory, 'uploads');
const { touchVisitor, liveVisitors, validVisitorId, recordDailyVisitor, visitorsByDay } = await import('./presence.js');
const { db } = await import('./db.js');

assert.equal(validVisitorId('abc'), false);
assert.equal(validVisitorId('has space in it'), false);
assert.equal(validVisitorId('a1b2c3d4-e5f6'), true);
assert.equal(touchVisitor('<script>alert(1)</script>'), false);

const t0 = 1_000_000;
assert.equal(touchVisitor('visitor-aaaa1111', t0), true);
assert.equal(touchVisitor('visitor-bbbb2222', t0 + 10_000), true);
assert.equal(touchVisitor('visitor-aaaa1111', t0 + 20_000), true); // same visitor, still one
assert.equal(liveVisitors(t0 + 30_000), 2);
assert.equal(liveVisitors(t0 + 75_000), 1); 
assert.equal(liveVisitors(t0 + 85_000), 0);

// Daily visitors: one per browser per day (Saigon time), stored only as a per-day hash.
const day1 = Date.parse('2026-10-15T03:00:00Z'); // 10:00 in Saigon
assert.equal(recordDailyVisitor('bad id!', day1), false);
recordDailyVisitor('browser-aaaa1111', day1);
recordDailyVisitor('browser-aaaa1111', day1 + 60_000); // same browser, same day: once
recordDailyVisitor('browser-bbbb2222', day1);
recordDailyVisitor('browser-aaaa1111', Date.parse('2026-10-15T18:00:00Z')); // 01:00 on the 16th in Saigon
assert.deepEqual(visitorsByDay('2026-10-01'), { '2026-10-15': 2, '2026-10-16': 1 });
const rows = db.prepare('SELECT visitor FROM visitor_days').all().map((r) => r.visitor);
assert.ok(rows.every((v) => !v.includes('browser')), 'the browser id itself is never stored');
assert.equal(new Set(rows).size, 3, 'the same browser on two days gets two unlinkable hashes');
fs.rmSync(directory, { recursive: true, force: true });

console.log('presence tests passed');
