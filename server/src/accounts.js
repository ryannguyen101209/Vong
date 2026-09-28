import crypto from 'node:crypto';
import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import { rateLimit } from 'express-rate-limit';
import { db } from './db.js';

const google = new OAuth2Client();
const COOKIE = 'vong_session';
const TTL = 1000 * 60 * 60 * 24 * 7;
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api' });

/** The public web client ID, or null. Stray whitespace from a dashboard paste would break the audience check. */
export function googleClientId() {
  return process.env.GOOGLE_CLIENT_ID?.trim() || null;
}

// Browsers send an Origin with no path or trailing slash, so normalise
// configured values like "https://vong.vn/" to match it.
const toOrigin = (value) => { try { return new URL(value).origin; } catch { return value; } };

/**
 * Origins allowed to call the API with cookies. Production sets CORS_ORIGIN;
 * the default covers `npm run dev` (Vite) and `npm start` (the API's own port).
 */
export function allowedOrigins() {
  const configured = (process.env.CORS_ORIGIN || '').split(',').map((value) => value.trim()).filter(Boolean);
  if (configured.length) return configured.map(toOrigin);
  return ['http://localhost:5173', 'http://localhost:5174', `http://localhost:${Number(process.env.PORT) || 4000}`];
}

function sessionToken(req) {
  return (req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) || '';
}

export function sessionUser(req, res, next) {
  res.set('Cache-Control', 'no-store');
  const token = sessionToken(req);
  req.user = token && db.prepare(`SELECT u.id, u.name, u.email, u.picture FROM users u
    JOIN user_sessions s ON s.user_id = u.id WHERE s.token_hash = ? AND s.expires_at > ?`).get(hash(token), Date.now());
  next();
}

export function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'sign_in_required' });
  next();
}

// A custom header cannot be sent by a cross-site form. Cross-origin JS must
// pass the explicit CORS allowlist before it can send this header or cookies.
export function protectWrites(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-Vong-Request') !== '1') return res.status(403).json({ error: 'invalid_request_origin' });
  const origin = req.get('origin');
  if (origin && !allowedOrigins().includes(origin)) return res.status(403).json({ error: 'invalid_request_origin' });
  next();
}

export function createAuthRouter(verify = async (credential, audience) => {
  const ticket = await google.verifyIdToken({ idToken: credential, audience });
  return ticket.getPayload();
}) {
  const router = express.Router();
  router.get('/config', (req, res) => res.json({ googleClientId: googleClientId() }));
  router.get('/me', (req, res) => res.json({ profile: req.user || null }));
  router.post('/google', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'too_many_attempts' } }), async (req, res, next) => {
    const audience = googleClientId();
    if (!audience) return res.status(503).json({ error: 'google_not_configured' });
    const credential = req.body?.credential;
    if (typeof credential !== 'string' || credential.length > 10000) return res.status(400).json({ error: 'invalid_credential' });
    let claims;
    try { claims = await verify(credential, audience); }
    catch (error) {
      // google-auth-library appends the raw token or its claims after ": ", so log only the reason.
      console.warn(`[auth] Google sign-in rejected: ${String(error?.message).split(': ')[0].slice(0, 120)}`);
      return res.status(401).json({ error: 'invalid_credential' });
    }
    if (!claims?.sub || !claims.email || claims.email_verified !== true) {
      console.warn('[auth] Google sign-in rejected: account has no verified email');
      return res.status(401).json({ error: 'invalid_credential' });
    }
    try {
      const profile = db.transaction(() => {
        db.prepare(`INSERT INTO users (id, google_sub, name, email, picture, created_at)
          VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(google_sub) DO UPDATE SET
          name = excluded.name, email = excluded.email, picture = excluded.picture`).run(
          crypto.randomUUID(), claims.sub, String(claims.name || claims.email).slice(0, 100), claims.email, claims.picture || null, new Date().toISOString());
        const user = db.prepare('SELECT id, name, email, picture FROM users WHERE google_sub = ?').get(claims.sub);
        const token = crypto.randomBytes(32).toString('hex');
        db.prepare('DELETE FROM user_sessions WHERE expires_at <= ? OR token_hash = ?').run(Date.now(), hash(sessionToken(req)));
        db.prepare('INSERT INTO user_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(hash(token), user.id, Date.now() + TTL);
        res.cookie(COOKIE, token, { ...cookieOptions(), maxAge: TTL });
        return user;
      })();
      res.json({ profile });
    } catch (error) { next(error); }
  });
  router.post('/logout', (req, res) => {
    db.prepare('DELETE FROM user_sessions WHERE token_hash = ?').run(hash(sessionToken(req)));
    res.clearCookie(COOKIE, cookieOptions());
    res.json({ ok: true });
  });
  return router;
}
