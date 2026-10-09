import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vong-seo-'));
process.env.DATABASE_FILE = path.join(directory, 'test.db');
process.env.UPLOADS_DIR = path.join(directory, 'uploads');
const { db } = await import('./db.js');
const { listingMeta, renderListingHead, browseMeta, mountSharePages } = await import('./share-pages.js');

const template = `<!doctype html><html><head>
    <title>Vòng</title>
    <meta name="description" content="default" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="Vòng" />
    <meta property="og:description" content="default" />
    <meta property="og:url" content="https://usevong.com/" />
    <meta property="og:image" content="https://usevong.com/og-image.png" />
    <meta name="twitter:image" content="https://usevong.com/og-image.png" />
  </head><body></body></html>`;
const dist = path.join(directory, 'dist');
fs.mkdirSync(dist);
fs.writeFileSync(path.join(dist, 'index.html'), template);

const row = {
  id: 'seo1', title_vi: 'Xe đạp </script><script>alert(1)</script>', description_vi: 'Xe đạp còn tốt, đi êm.',
  price_vnd: 1500000, district: 'binh_thanh', category: 'sports', condition: 'good', status: 'published', images: '[]', image_path: '/uploads/a.jpg',
};

// Product data for Google, with the price in VND and secondhand condition.
const meta = listingMeta(row);
assert.equal(meta.jsonLd['@type'], 'Product');
assert.equal(meta.jsonLd.offers.price, 1500000);
assert.equal(meta.jsonLd.offers.priceCurrency, 'VND');
assert.equal(meta.jsonLd.offers.itemCondition, 'https://schema.org/UsedCondition');
assert.equal(meta.jsonLd.offers.availableAtOrFrom.name, 'Bình Thạnh, TP. Hồ Chí Minh');

// Seller text can never break out of the JSON block.
const html = renderListingHead(template, meta);
const block = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
assert.ok(!block.includes('<'), 'no raw < inside the JSON block');
assert.equal(JSON.parse(block).name, row.title_vi);
assert.equal((html.match(/<script/g) || []).length, 1, 'only the one script tag');

// Category and district pages.
assert.equal(browseMeta('sports', 'binh_thanh').title, 'Đồ thể thao cũ ở Bình Thạnh | Vòng');
assert.equal(browseMeta('', 'district_7').title, 'Đồ cũ ở Quận 7 | Vòng');
assert.equal(browseMeta('books', '').ogTitle, 'Sách cũ ở Sài Gòn');
assert.equal(browseMeta('', ''), null);
assert.equal(browseMeta('weapons', 'mars'), null);

// Served by the app, and listed in the sitemap only when something is for sale there.
db.prepare(`INSERT INTO listings (id, ref, title_vi, description_vi, category, price_vnd, district, condition, seller_name, seller_phone, status, fee_vnd, created_at, published_at)
  VALUES ('seo1', 'VONG-SEO1', 'Xe đạp', 'Xe đạp còn tốt, đi êm.', 'sports', 1500000, 'binh_thanh', 'good', 'A', '0900000000', 'published', 0, ?, ?)`)
  .run(new Date().toISOString(), new Date().toISOString());
const app = express();
mountSharePages(app, dist);
app.use((req, res) => res.status(404).send('fallthrough'));
const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;
try {
  const page = await (await fetch(`${base}/browse?category=sports`)).text();
  assert.ok(page.includes('<title>Đồ thể thao cũ ở Sài Gòn | Vòng</title>'));
  assert.ok(page.includes('<link rel="canonical" href="https://usevong.com/browse?category=sports" />'));
  assert.ok(page.includes('<meta property="og:type" content="website" />'));
  assert.equal(await (await fetch(`${base}/browse?q=xe`)).text(), 'fallthrough', 'plain searches use the normal page');

  const listingPage = await (await fetch(`${base}/listing/seo1`)).text();
  assert.ok(listingPage.includes('application/ld+json'));

  const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
  assert.ok(sitemap.includes('/browse?category=sports</loc>'));
  assert.ok(sitemap.includes('/browse?district=binh_thanh</loc>'));
  assert.ok(!sitemap.includes('category=books'), 'empty categories are left out');
  assert.ok(sitemap.includes('/rules</loc>'));
  console.log('seo tests passed');
} finally {
  server.close();
  fs.rmSync(directory, { recursive: true, force: true });
}
