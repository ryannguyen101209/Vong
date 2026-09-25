import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import { db, getSettings, SERVER_ROOT, UPLOADS_DIR } from './db.js';
import { router as listingsRouter } from './routes/listings.js';
import { router as adminRouter } from './routes/admin.js';
import { usingDefaultPassword } from './auth.js';
import { createAuthRouter, protectWrites, sessionUser } from './accounts.js';
import { router as conversationsRouter } from './routes/conversations.js';
import { rateLimit } from 'express-rate-limit';
import { CATEGORIES, DISTRICTS, CONDITIONS } from './catalog.js';

dotenv.config({ path: path.join(SERVER_ROOT, '..', '.env') });
dotenv.config({ path: path.join(SERVER_ROOT, '.env') });

const app = express();
// Set only to the known number of trusted reverse-proxy hops on the host.
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS) || false);
const PORT = Number(process.env.PORT) || 4000;

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5174').split(',').map((origin) => origin.trim());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 240, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'too_many_requests' } }));
app.use('/api', protectWrites, sessionUser);
app.use('/api/auth', createAuthRouter());
app.use('/api/conversations', conversationsRouter);
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('X-Frame-Options', 'DENY');
  res.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});

// Uploaded and seed images. In production put these behind a CDN or object
// store -- local disk does not survive a redeploy on most hosts.
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '1h' }));

/** The lists the Sell form and Browse filters are built from. */
app.get('/api/meta', (req, res) => {
  const settings = getSettings();
  res.json({
    categories: CATEGORIES,
    districts: DISTRICTS,
    conditions: CONDITIONS,
    fee_vnd: settings.fee_vnd,
  });
});

app.get('/api/health', (req, res) => {
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM listings WHERE status = 'published' AND is_seed = 0").get();
  res.json({ ok: true, published_listings: n, admin_password_is_default: usingDefaultPassword() });
});

/**
 * POST /api/contact — stores the message and prints it to the server log.
 * It does NOT send an email; see README, "What is stubbed".
 */
app.post('/api/contact', (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  const email = String(req.body?.email ?? '').trim();
  const body = String(req.body?.message ?? '').trim();

  const errors = {};
  if (name.length < 2 || name.length > 80) errors.name = 'length';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.email = 'invalid';
  if (body.length < 10 || body.length > 4000) errors.message = 'length';
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ error: 'validation_failed', fields: errors });
  }

  db.prepare('INSERT INTO messages (name, email, body, created_at) VALUES (?, ?, ?, ?)')
    .run(name, email, body, new Date().toISOString());

  console.log(`[contact] ${name} <${email}>: ${body.slice(0, 120)}`);
  res.status(201).json({ ok: true });
});

app.use('/api/listings', listingsRouter);
app.use('/api/admin', adminRouter);

// Serve the built frontend if it exists, so `npm run build && npm start` gives
// you the whole app on one port. In dev, Vite serves the client instead.
const clientDist = path.join(SERVER_ROOT, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api|\/uploads).*/, (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use((req, res) => res.status(404).json({ error: 'not_found' }));

// eslint-disable-next-line no-unused-vars -- Express needs the 4-arg signature.
app.use((err, req, res, next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'image_too_large' });
  }
  console.error(err);
  res.status(500).json({ error: 'server_error' });
});

app.listen(PORT, () => {
  console.log(`Vong API listening on http://localhost:${PORT}`);
  if (usingDefaultPassword()) {
    console.log('⚠  ADMIN_PASSWORD is not set — the admin page accepts "vong-admin". Set it in .env before deploying.');
  }
});
