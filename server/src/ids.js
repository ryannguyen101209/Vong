import crypto from 'node:crypto';

// No I, O, 0 or 1 -- these codes get read off a phone screen and typed into a
// bank transfer note, so ambiguous characters cause real support headaches.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(length) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function newId() {
  return crypto.randomUUID();
}

/** The reference the seller puts in their bank transfer, e.g. VONG-A1B2C3. */
export function newRef() {
  return `VONG-${randomCode(6)}`;
}
