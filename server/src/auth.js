/*
 * Admin access is a single shared password from the environment, exchanged for
 * an in-memory bearer token. Tokens die when the server restarts, which is fine
 * for one admin. If Vong ever has more than one person approving payments,
 * replace this with real accounts -- see README, "What is stubbed".
 */
import crypto from 'node:crypto';

const TOKEN_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours
const tokens = new Map(); // token -> expiry timestamp

export function adminPassword() {
  return process.env.ADMIN_PASSWORD || 'vong-admin';
}

export function usingDefaultPassword() {
  return !process.env.ADMIN_PASSWORD;
}

export function login(password) {
  const expected = adminPassword();
  const given = String(password ?? '');
  // Constant-time compare so the password can't be guessed a character at a time.
  const a = Buffer.from(given.padEnd(64).slice(0, 64));
  const b = Buffer.from(expected.padEnd(64).slice(0, 64));
  if (!crypto.timingSafeEqual(a, b) || given.length !== expected.length) return null;

  const token = crypto.randomBytes(32).toString('hex');
  tokens.set(token, Date.now() + TOKEN_TTL_MS);
  return { token, expiresIn: TOKEN_TTL_MS };
}

export function logout(token) {
  tokens.delete(token);
}

/** Express middleware: 401 unless a live admin token is presented. */
export function requireAdmin(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const expiry = tokens.get(token);

  if (!expiry || expiry < Date.now()) {
    if (expiry) tokens.delete(token);
    return res.status(401).json({ error: 'admin_auth_required' });
  }
  return next();
}
