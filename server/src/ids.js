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

/** A listing's reference code, e.g. VONG-A1B2C3. */
export function newRef() {
  return `VONG-${randomCode(6)}`;
}

// SePay only reports a VietinBank transfer to the webhook when the note starts
// with this keyword. Payment matching still looks for VONG-XXXXXX anywhere in the note.
export const TRANSFER_KEYWORD = 'SEVQR';

/** What the seller types in the bank transfer note, e.g. "SEVQR VONG-A1B2C3". */
export function transferNote(ref) {
  return `${TRANSFER_KEYWORD} ${ref}`;
}
