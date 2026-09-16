import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.join(here, '..');
export const DATA_DIR = path.join(SERVER_ROOT, 'data');
export const UPLOADS_DIR = path.join(SERVER_ROOT, 'uploads');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const dbFile = process.env.DATABASE_FILE
  ? path.resolve(SERVER_ROOT, process.env.DATABASE_FILE)
  : path.join(DATA_DIR, 'vong.db');

export const db = new Database(dbFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/*
 * A listing moves: pending_payment -> awaiting_approval -> published | rejected
 * Nothing here ever touches buyer money. The only money Vong knows about is the
 * flat listing fee the seller transfers to us, and even that is confirmed by a
 * human looking at a bank app.
 */
db.exec(`
  CREATE TABLE IF NOT EXISTS listings (
    id              TEXT PRIMARY KEY,
    ref             TEXT NOT NULL UNIQUE,
    -- A seller writes in one language only, so either column may be empty; the
    -- CHECKs guarantee at least one variant of each exists. Seed listings have both.
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
