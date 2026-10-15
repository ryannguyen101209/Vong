import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Browser protections on every response.
 *
 * The content security policy lets pages run only Vòng's own scripts, Google
 * Sign-In, and the one small inline script in index.html (the dark-theme
 * check before first paint), allowed by its hash. So even if a bug ever let
 * someone put markup on a page, their script would not run.
 */
function inlineScriptHashes(clientDist) {
  try {
    const html = fs.readFileSync(path.join(clientDist, 'index.html'), 'utf8');
    return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
      .map((m) => `'sha256-${crypto.createHash('sha256').update(m[1]).digest('base64')}'`);
  } catch {
    return []; // no build yet (dev): Vite serves the pages instead
  }
}

export function contentSecurityPolicy(clientDist) {
  const google = 'https://accounts.google.com';
  return [
    "default-src 'self'",
    `script-src 'self' ${google}/gsi/client ${inlineScriptHashes(clientDist).join(' ')}`.trim(),
    `style-src 'self' 'unsafe-inline' ${google}/gsi/style`,
    "img-src 'self' data: blob: https://*.googleusercontent.com",
    "font-src 'self' data:",
    `connect-src 'self' ${google}/gsi/`,
    `frame-src ${google}/gsi/`,
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

export function securityHeaders(clientDist) {
  const csp = contentSecurityPolicy(clientDist);
  return (req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.set('X-Frame-Options', 'DENY');
    res.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.set('Content-Security-Policy', csp);
    if (process.env.NODE_ENV === 'production') res.set('Strict-Transport-Security', 'max-age=31536000');
    next();
  };
}
