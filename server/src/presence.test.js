import assert from 'node:assert/strict';
import { touchVisitor, liveVisitors, validVisitorId } from './presence.js';

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
console.log('presence tests passed');
