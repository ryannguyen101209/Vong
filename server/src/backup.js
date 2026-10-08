/**
 * Database backups.
 *
 * Everything that matters (listings, accounts, chats, payments) lives in one
 * SQLite file on the host's disk. If that disk is lost, so is the business.
 *
 * - GET /api/admin/backup downloads a consistent copy at any time.
 * - With BACKUP_EMAIL and RESEND_API_KEY set, a gzipped copy is emailed once a
 *   day, so a recent backup always sits in an inbox off the server.
 *
 * Photos in UPLOADS_DIR are not included; see README.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { db } from './db.js';
import { sendMail, mailEnabled } from './mailer.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const CHECK_EVERY_MS = 60 * 60 * 1000;
// Resend accepts up to 40MB per email, after base64 (which adds a third).
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

db.exec(`CREATE TABLE IF NOT EXISTS backup_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL,
  bytes INTEGER NOT NULL, outcome TEXT NOT NULL)`);

/** A gzipped, consistent copy of the database, safe to take while the site is running. */
export async function snapshot() {
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vong-backup-')), 'vong.db');
  try {
    await db.backup(tmp);
    return zlib.gzipSync(fs.readFileSync(tmp));
  } finally {
    fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
  }
}

export const backupFilename = (now = new Date()) => `vong-backup-${now.toISOString().slice(0, 10)}.db.gz`;

export const backupEmail = () => process.env.BACKUP_EMAIL?.trim() || '';

/** The last emailed backup that went out, or null. */
export function lastEmailedBackup() {
  return db.prepare("SELECT created_at, bytes FROM backup_log WHERE outcome = 'sent' ORDER BY id DESC LIMIT 1").get() ?? null;
}

/** Email one backup now. Returns 'sent' | 'too_large' | 'failed' | 'off'. Never throws. */
export async function emailBackup(now = new Date()) {
  const to = backupEmail();
  if (!to || !mailEnabled()) return 'off';
  let outcome = 'failed';
  let bytes = 0;
  try {
    const gz = await snapshot();
    bytes = gz.length;
    const date = now.toISOString().slice(0, 10);
    if (gz.length > MAX_ATTACHMENT_BYTES) {
      outcome = (await sendMail({
        to,
        subject: `Vòng backup ${date}: too large to email`,
        text: `Today's database backup is ${(gz.length / 1048576).toFixed(1)} MB, more than an email can carry. Download it from Admin > Settings > Backup, and consider moving backups to object storage.`,
        html: `<p>Today's database backup is ${(gz.length / 1048576).toFixed(1)} MB, more than an email can carry.</p><p>Download it from <b>Admin &gt; Settings &gt; Backup</b>, and consider moving backups to object storage.</p>`,
        timeoutMs: 30_000,
      })) ? 'too_large' : 'failed';
    } else {
      const ok = await sendMail({
        to,
        subject: `Vòng backup ${date}`,
        text: `Attached: the Vòng database as of ${now.toISOString()} (${(gz.length / 1024).toFixed(0)} KB, gzipped SQLite).\n\nTo restore: gunzip it, stop the site, replace the file at DATABASE_FILE, start the site.\nKeep this email private: it contains sellers' phone numbers and emails.`,
        html: `<p>Attached: the Vòng database as of ${now.toISOString()} (${(gz.length / 1024).toFixed(0)} KB, gzipped SQLite).</p><p>To restore: gunzip it, stop the site, replace the file at <code>DATABASE_FILE</code>, start the site.</p><p><b>Keep this email private:</b> it contains sellers' phone numbers and emails.</p>`,
        attachments: [{ filename: backupFilename(now), content: gz.toString('base64') }],
        timeoutMs: 60_000,
      });
      outcome = ok ? 'sent' : 'failed';
    }
  } catch (err) {
    console.error('[backup] failed', err);
  }
  db.prepare('INSERT INTO backup_log (created_at, bytes, outcome) VALUES (?, ?, ?)').run(now.toISOString(), bytes, outcome);
  if (outcome !== 'sent') console.error(`[backup] emailed backup outcome: ${outcome}`);
  return outcome;
}

/** Email a backup if the last one that went out is a day old (or there is none). */
export async function backupIfDue(now = new Date()) {
  if (!backupEmail() || !mailEnabled()) return 'off';
  const last = lastEmailedBackup();
  if (last && now - new Date(last.created_at) < DAY_MS - 5 * 60 * 1000) return 'not_due';
  return emailBackup(now);
}

/**
 * Check every hour. The "is it due" check uses the log, not a timer, so a
 * deploy or restart neither skips a day nor sends an extra copy.
 */
export function startBackupSchedule() {
  if (!backupEmail()) return;
  const run = () => { backupIfDue().catch(() => {}); };
  setTimeout(run, 2 * 60 * 1000).unref();
  setInterval(run, CHECK_EVERY_MS).unref();
}
