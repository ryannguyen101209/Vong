import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.join(here, '..');
dotenv.config({ path: path.join(SERVER_ROOT, '..', '.env') });
export const DATA_DIR = path.join(SERVER_ROOT, 'data');
// Both of these can point at a mounted disk in production. On hosts with an
// ephemeral filesystem (Vercel, Netlify Functions) uploads and the database are
// wiped on every deploy -- see DEPLOY.md.
export const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(SERVER_ROOT, process.env.UPLOADS_DIR)
  : path.join(SERVER_ROOT, 'uploads');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const dbFile = process.env.DATABASE_FILE
  ? path.resolve(SERVER_ROOT, process.env.DATABASE_FILE)
  : path.join(DATA_DIR, 'vong.db');

export const db = new Database(dbFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/*
 * A listing moves:
 *   pending_payment -> awaiting_approval -> approved -> published
 *                                        \-> rejected (seller can mark paid again)
 * "approved" means a human checked the transfer and a one-time publish key was
 * emailed to the seller; the listing goes live when the seller enters it.
 * Nothing here ever touches buyer money. The only money Vong knows about is the
 * flat listing fee the seller transfers to us, and even that is confirmed by a
 * human looking at a bank app.
 */
db.exec(`
  CREATE TABLE IF NOT EXISTS listings (
    id              TEXT PRIMARY KEY,
    ref             TEXT NOT NULL UNIQUE,
    -- A seller writes in one language only, so either column may be empty; the
    -- CHECKs guarantee at least one variant of each exists.
    title_en        TEXT,
    title_vi        TEXT,
    description_en  TEXT,
    description_vi  TEXT,
    category        TEXT NOT NULL,
    price_vnd       INTEGER NOT NULL,
    district        TEXT NOT NULL,
    condition       TEXT NOT NULL,
    seller_name     TEXT NOT NULL,
    seller_phone    TEXT NOT NULL,
    seller_email    TEXT,
    image_path      TEXT,
    status          TEXT NOT NULL DEFAULT 'pending_payment',
    reject_reason   TEXT,
    fee_vnd         INTEGER NOT NULL,
    views           INTEGER NOT NULL DEFAULT 0,
    is_seed         INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL,
    paid_marked_at  TEXT,
    reviewed_at     TEXT,
    published_at    TEXT,

    CHECK (COALESCE(title_en, title_vi) IS NOT NULL),
    CHECK (COALESCE(description_en, description_vi) IS NOT NULL)
  );

  CREATE INDEX IF NOT EXISTS idx_listings_status  ON listings(status);
  CREATE INDEX IF NOT EXISTS idx_listings_created ON listings(created_at DESC);

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  -- "Request to buy" does not message anyone: it reveals the seller's phone/Zalo
  -- and records that it happened, so the seller can see interest on the listing.
  CREATE TABLE IF NOT EXISTS buy_requests (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL
  );

  -- Contact form submissions land here. Nothing emails anyone yet (see README).
  CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL,
    body       TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

/*
 * Migration: the first version of this schema required English text, which broke
 * listings written in Vietnamese. Rebuild the table if an old database is found.
 */
const titleColumn = db.prepare("PRAGMA table_info(listings)").all().find((c) => c.name === 'title_en');
if (titleColumn?.notnull === 1) {
  console.log('Migrating listings table: title/description no longer require English text…');
  db.exec(`
    PRAGMA foreign_keys = OFF;
    -- legacy_alter_table keeps RENAME from rewriting other tables' foreign keys,
    -- which would otherwise leave buy_requests pointing at the dropped table.
    PRAGMA legacy_alter_table = ON;
    BEGIN;
    ALTER TABLE listings RENAME TO listings_old;
    CREATE TABLE listings (
      id TEXT PRIMARY KEY, ref TEXT NOT NULL UNIQUE,
      title_en TEXT, title_vi TEXT, description_en TEXT, description_vi TEXT,
      category TEXT NOT NULL, price_vnd INTEGER NOT NULL, district TEXT NOT NULL,
      condition TEXT NOT NULL, seller_name TEXT NOT NULL, seller_phone TEXT NOT NULL,
      image_path TEXT, status TEXT NOT NULL DEFAULT 'pending_payment', reject_reason TEXT,
      fee_vnd INTEGER NOT NULL, views INTEGER NOT NULL DEFAULT 0, is_seed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, paid_marked_at TEXT, reviewed_at TEXT, published_at TEXT,
      CHECK (COALESCE(title_en, title_vi) IS NOT NULL),
      CHECK (COALESCE(description_en, description_vi) IS NOT NULL)
    );
    INSERT INTO listings SELECT * FROM listings_old;
    DROP TABLE listings_old;
    COMMIT;
    PRAGMA legacy_alter_table = OFF;
    PRAGMA foreign_keys = ON;
    CREATE INDEX IF NOT EXISTS idx_listings_status  ON listings(status);
    CREATE INDEX IF NOT EXISTS idx_listings_created ON listings(created_at DESC);
  `);
}

/* Migration: sellers now give an email so they can be told when a listing is
 * approved. Existing listings keep an empty one. */
const columns = db.prepare('PRAGMA table_info(listings)').all().map((c) => c.name);
if (!columns.includes('seller_email')) {
  console.log('Adding seller_email to listings…');
  db.exec('ALTER TABLE listings ADD COLUMN seller_email TEXT');
}

/* Repair databases whose buy_requests foreign key was rewritten by the migration
 * above before it used legacy_alter_table. Interest rows are preserved. */
const buyRequestsDdl = db
  .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'buy_requests'")
  .get()?.sql ?? '';
if (buyRequestsDdl.includes('listings_old')) {
  console.log('Repairing buy_requests foreign key…');
  db.exec(`
    PRAGMA foreign_keys = OFF;
    BEGIN;
    CREATE TABLE buy_requests_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL
    );
    INSERT INTO buy_requests_new (id, listing_id, created_at)
      SELECT id, listing_id, created_at FROM buy_requests;
    DROP TABLE buy_requests;
    ALTER TABLE buy_requests_new RENAME TO buy_requests;
    COMMIT;
    PRAGMA foreign_keys = ON;
  `);
}

// Accounts are linked by verified Google subject, never by a browser-supplied
// profile or a listing's email. Old listings are not silently claimed.
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, google_sub TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
    email TEXT NOT NULL, picture TEXT, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS user_sessions (
    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_session_expiry ON user_sessions(expires_at);
`);
if (!columns.includes('seller_id')) db.exec('ALTER TABLE listings ADD COLUMN seller_id TEXT REFERENCES users(id)');

// The publish key is stored only as a hash. Attempts are counted so a key
// cannot be guessed; a locked or expired key has to be re-sent.
for (const [name, type] of [
  ['publish_key_hash', 'TEXT'],
  ['publish_key_expires_at', 'INTEGER'],
  ['publish_key_attempts', 'INTEGER NOT NULL DEFAULT 0'],
  ['publish_key_sent_at', 'TEXT'],
]) {
  if (!columns.includes(name)) db.exec(`ALTER TABLE listings ADD COLUMN ${name} ${type}`);
}

// Earlier versions shipped invented sample listings. Nothing fake is shown any
// more, so remove them outright rather than hiding them.
const removedSamples = db.prepare('DELETE FROM listings WHERE is_seed = 1').run().changes;
if (removedSamples > 0) console.log(`Removed ${removedSamples} sample listing(s).`);
db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    buyer_id TEXT NOT NULL REFERENCES users(id),
    seller_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    UNIQUE(listing_id, buyer_id), CHECK(buyer_id <> seller_id)
  );
  CREATE INDEX IF NOT EXISTS idx_conversation_buyer ON conversations(buyer_id, updated_at);
  CREATE INDEX IF NOT EXISTS idx_conversation_seller ON conversations(seller_id, updated_at);
  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL REFERENCES users(id),
    body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),
    client_id TEXT NOT NULL, created_at TEXT NOT NULL,
    UNIQUE(conversation_id, sender_id, client_id)
  );
  CREATE INDEX IF NOT EXISTS idx_chat_conversation ON chat_messages(conversation_id, id);
`);

// Highest message id each side has seen, for unread counts.
const conversationColumns = db.prepare('PRAGMA table_info(conversations)').all().map((c) => c.name);
for (const name of ['buyer_last_read', 'seller_last_read']) {
  if (!conversationColumns.includes(name)) db.exec(`ALTER TABLE conversations ADD COLUMN ${name} INTEGER NOT NULL DEFAULT 0`);
}

export const DEFAULT_SETTINGS = {
  bank_bin: '970436',
  bank_name: 'Vietcombank',
  account_number: '1234567890',
  account_holder: 'NGUYEN VAN A',
  fee_vnd: '10000',
};

const insertSetting = db.prepare(
  'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING'
);
for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) insertSetting.run(key, value);

export function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = { ...DEFAULT_SETTINGS };
  for (const row of rows) out[row.key] = row.value;
  return { ...out, fee_vnd: Number(out.fee_vnd) || 0 };
}

export function saveSettings(patch) {
  const stmt = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  const allowed = Object.keys(DEFAULT_SETTINGS);
  const write = db.transaction((entries) => {
    for (const [key, value] of entries) {
      if (allowed.includes(key)) stmt.run(key, String(value));
    }
  });
  write(Object.entries(patch));
  return getSettings();
}
