/*
 * Turns the server's seed listings into a JSON file the demo build can embed,
 * so the shareable static demo shows the same 10 listings as a real install.
 * Run automatically by `npm run demo`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEED_LISTINGS } from '../../server/src/seed-data.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '..', 'src', 'lib', 'demo-listings.json');

const listings = SEED_LISTINGS.map((listing, index) => {
  const createdAt = new Date(Date.now() - listing.days_ago * 86400000).toISOString();
  return {
    id: `seed-${index + 1}`,
    ref: `VONG-DEMO${String(index + 1).padStart(2, '0')}`,
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
    // Relative on purpose: the demo is served from a subdirectory.
    image_path: `uploads/seed/${listing.slug}.svg`,
    status: 'published',
    reject_reason: null,
    fee_vnd: 10000,
    views: listing.views,
    created_at: createdAt,
    published_at: createdAt,
  };
});

fs.writeFileSync(out, `${JSON.stringify(listings, null, 2)}\n`);
console.log(`Wrote ${listings.length} demo listings to src/lib/demo-listings.json`);
