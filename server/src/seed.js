/*
 * Loads the sample listings. Safe to run twice: it skips seeding if seed rows
 * are already present. `npm run reset` wipes seed rows (and only seed rows)
 * first, leaving anything you created by hand in the app alone.
 */
import { db, getSettings } from './db.js';
import { SEED_LISTINGS } from './seed-data.js';
import { writePlaceholders } from './placeholders.js';
import { newId, newRef } from './ids.js';

const reset = process.argv.includes('--reset');

if (reset) {
  const removed = db.prepare('DELETE FROM listings WHERE is_seed = 1').run();
  console.log(`Removed ${removed.changes} seed listing(s).`);
}

const existing = db.prepare('SELECT COUNT(*) AS n FROM listings WHERE is_seed = 1').get().n;
if (existing > 0) {
  console.log(`${existing} seed listing(s) already present — nothing to do.`);
  console.log('Run `npm run reset` to reload them from scratch.');
  process.exit(0);
}

const images = writePlaceholders();
const { fee_vnd: fee } = getSettings();

const insert = db.prepare(`
  INSERT INTO listings (
    id, ref, title_en, title_vi, description_en, description_vi, category,
    price_vnd, district, condition, seller_name, seller_phone, seller_email, image_path,
    status, fee_vnd, views, is_seed, created_at, paid_marked_at, reviewed_at, published_at
  ) VALUES (
    @id, @ref, @title_en, @title_vi, @description_en, @description_vi, @category,
    @price_vnd, @district, @condition, @seller_name, @seller_phone, @seller_email, @image_path,
    'published', @fee_vnd, @views, 1, @created_at, @created_at, @created_at, @created_at
  )
`);

const insertAll = db.transaction((listings) => {
  for (const listing of listings) {
    const createdAt = new Date(Date.now() - listing.days_ago * 86400000).toISOString();
    insert.run({
      id: newId(),
      ref: newRef(),
      title_en: listing.title_en,
      title_vi: listing.title_vi,
      description_en: listing.description_en,
      description_vi: listing.description_vi,
      category: listing.category,
      price_vnd: listing.price_vnd,
      district: listing.district,
      condition: listing.condition,
      seller_name: listing.seller_name,
      seller_phone: listing.seller_phone,
      seller_email: listing.seller_email,
      image_path: images[listing.slug] ?? null,
      fee_vnd: fee,
      views: listing.views,
      created_at: createdAt,
    });
  }
});

insertAll(SEED_LISTINGS);
console.log(`Seeded ${SEED_LISTINGS.length} published listings and ${Object.keys(images).length} placeholder images.`);
