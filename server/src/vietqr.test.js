/* Run with: node src/vietqr.test.js  (no test framework needed) */
import assert from 'node:assert/strict';
import { crc16ccitt, buildVietQrPayload, sanitizeNote } from './vietqr.js';

// The standard CRC-16/CCITT-FALSE check value for the string "123456789".
assert.equal(crc16ccitt('123456789'), '29B1');

const payload = buildVietQrPayload({
  bankBin: '970436',
  accountNumber: '1234567890',
  amount: 10000,
  note: 'VONG-A1B2C3',
});

// Walk the TLV structure back out and check every field we claim to emit.
function parse(str) {
  const out = {};
  let i = 0;
  while (i < str.length) {
    const tag = str.slice(i, i + 2);
    const len = Number(str.slice(i + 2, i + 4));
    out[tag] = str.slice(i + 4, i + 4 + len);
    i += 4 + len;
  }
  return out;
}

const fields = parse(payload);
assert.equal(fields['00'], '01', 'payload format indicator');
assert.equal(fields['01'], '12', 'dynamic QR (carries an amount)');
assert.equal(fields['53'], '704', 'currency VND');
assert.equal(fields['54'], '10000', 'amount');
assert.equal(fields['58'], 'VN', 'country');

const merchant = parse(fields['38']);
assert.equal(merchant['00'], 'A000000727', 'VietQR GUID');
assert.equal(merchant['02'], 'QRIBFTTA', 'transfer-to-account service code');
const beneficiary = parse(merchant['01']);
assert.equal(beneficiary['00'], '970436', 'bank BIN');
assert.equal(beneficiary['01'], '1234567890', 'account number');
assert.equal(parse(fields['62'])['08'], 'VONG-A1B2C3', 'transfer note');

// The CRC must validate over everything up to and including "6304".
const body = payload.slice(0, -4);
assert.equal(crc16ccitt(body), payload.slice(-4), 'trailing CRC');
assert.match(payload, /^000201/);

// Diacritics are folded, unsupported characters dropped.
assert.equal(sanitizeNote('Phí đăng tin Vòng'), 'PHI DANG TIN VONG');

// Bad input is rejected loudly rather than producing an unscannable code.
assert.throws(() => buildVietQrPayload({ bankBin: '97043', accountNumber: '1', amount: 1 }));
assert.throws(() => buildVietQrPayload({ bankBin: '970436', accountNumber: '', amount: 1 }));

console.log('vietqr: all assertions passed');
console.log(payload);
