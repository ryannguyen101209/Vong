// An existing database gets the read-marker table on start, with every old
// message already counted as read.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vong-unread-mig-'));
const file = path.join(directory, 'old.db');
process.env.DATABASE_FILE = file;
process.env.UPLOADS_DIR = path.join(directory, 'uploads');

// Build the schema once, add old chats, then drop the new table to mimic a database from before this change.
{
  const { db } = await import(`./db.js?first`);
  db.prepare("INSERT INTO users (id, google_sub, email, name, created_at) VALUES ('u1','s1','a@x.test','A',''), ('u2','s2','b@x.test','B','')").run();
  db.prepare("INSERT INTO listings (id, ref, title_en, description_en, category, price_vnd, district, condition, seller_name, seller_phone, status, fee_vnd, created_at, seller_id) VALUES ('l1','VONG-AAAAAA','Lamp','A lamp for the migration test.','furniture',1,'district_1','good','A','0900000000','published',0,'', 'u1')").run();
  db.prepare("INSERT INTO conversations (id, listing_id, buyer_id, seller_id, created_at, updated_at) VALUES ('c1','l1','u2','u1','','')").run();
  db.prepare("INSERT INTO chat_messages (conversation_id, sender_id, body, client_id, created_at) VALUES ('c1','u2','hi','client-aaaa',''), ('c1','u1','hello','client-bbbb','')").run();
  db.exec('DROP TABLE conversation_reads');
  db.close();
}
const { db } = await import(`./db.js?second`);
const reads = db.prepare('SELECT user_id, last_read_id FROM conversation_reads ORDER BY user_id').all();
assert.deepEqual(reads, [{ user_id: 'u1', last_read_id: 2 }, { user_id: 'u2', last_read_id: 2 }]);
console.log('unread migration tests passed');
