import fs from 'node:fs';
import path from 'node:path';
import { db } from './db.js';

/**
 * Link previews and search indexing.
 *
 * The app is a single page, so every URL used to return the same <head>. A
 * listing link pasted into Zalo or Facebook therefore showed the generic Vòng
 * card. Here the server fills in that listing's photo, title, price and
 * district before sending the page, and publishes a sitemap of live listings.
 */

const SITE = (process.env.PUBLIC_URL || 'https://usevong.com').replace(/\/$/, '');

const DISTRICTS = {
  en: {
    district_1: 'District 1', district_2: 'District 2', district_3: 'District 3', district_4: 'District 4',
    district_5: 'District 5', district_6: 'District 6', district_7: 'District 7', district_8: 'District 8',
    district_9: 'District 9', district_10: 'District 10', district_11: 'District 11', district_12: 'District 12',
  },
  vi: {
    district_1: 'Quận 1', district_2: 'Quận 2', district_3: 'Quận 3', district_4: 'Quận 4',
    district_5: 'Quận 5', district_6: 'Quận 6', district_7: 'Quận 7', district_8: 'Quận 8',
    district_9: 'Quận 9', district_10: 'Quận 10', district_11: 'Quận 11', district_12: 'Quận 12',
  },
  shared: {
    binh_tan: 'Bình Tân', binh_thanh: 'Bình Thạnh', go_vap: 'Gò Vấp', phu_nhuan: 'Phú Nhuận',
    tan_binh: 'Tân Bình', tan_phu: 'Tân Phú', thu_duc: 'Thủ Đức', binh_chanh: 'Bình Chánh',
    can_gio: 'Cần Giờ', cu_chi: 'Củ Chi', hoc_mon: 'Hóc Môn', nha_be: 'Nhà Bè', thao_dien: 'Thảo Điền',
  },
};

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const formatVnd = (n) => `${Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}₫`;

function shorten(text, max) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
}

function coverImage(row) {
  let images = [];
  try { images = JSON.parse(row.images || '[]'); } catch { images = []; }
  const first = (Array.isArray(images) && images[0]) || row.image_path;
  if (!first) return `${SITE}/og-image.png`;
  return /^https?:\/\//.test(first) ? first : `${SITE}${first.startsWith('/') ? '' : '/'}${first}`;
}

/** Builds the <head> tags for one listing. Exported for tests. */
export function listingMeta(row) {
  // Vietnamese first, like the site itself; English only when there is no Vietnamese title.
  const lang = row.title_vi ? 'vi' : 'en';
  const title = row.title_vi || row.title_en;
  const district = DISTRICTS[lang][row.district] || DISTRICTS.shared[row.district] || '';
  const description = lang === 'vi' ? row.description_vi || row.description_en : row.description_en || row.description_vi;
  const headline = `${title} · ${formatVnd(row.price_vnd)}${district ? ` · ${district}` : ''}`;
  return {
    title: `${headline} | Vòng`,
    ogTitle: headline,
    description: shorten(description, 180),
    url: `${SITE}/listing/${encodeURIComponent(row.id)}`,
    image: coverImage(row),
    imageAlt: title,
  };
}

/** Swaps the default tags in the built index.html for a listing's own. */
export function renderListingHead(html, meta) {
  const set = (pattern, replacement) => { html = html.replace(pattern, replacement); };
  const t = escapeHtml(meta.title);
  const ogt = escapeHtml(meta.ogTitle);
  const d = escapeHtml(meta.description);
  const u = escapeHtml(meta.url);
  const img = escapeHtml(meta.image);

  set(/<title>[^<]*<\/title>/, `<title>${t}</title>`);
  set(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${d}" />`);
  set(/<meta property="og:type" content="[^"]*"\s*\/?>/, '<meta property="og:type" content="product" />');
  set(/<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${ogt}" />`);
  set(/<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${d}" />`);
  set(/<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${u}" />`);
  set(/<meta property="og:image" content="[^"]*"\s*\/?>/,
    `<meta property="og:image" content="${img}" />\n    <meta property="og:image:alt" content="${escapeHtml(meta.imageAlt)}" />`);
  // The listing photo is not 1200x630, so drop the size hints meant for the default card.
  set(/\s*<meta property="og:image:width" content="[^"]*"\s*\/?>/, '');
  set(/\s*<meta property="og:image:height" content="[^"]*"\s*\/?>/, '');
  set(/<meta name="twitter:image" content="[^"]*"\s*\/?>/, `<meta name="twitter:image" content="${img}" />`);
  set(/\n(\s*)<\/head>/, (m, indent) => `\n${indent}  <link rel="canonical" href="${u}" />\n${indent}</head>`);
  return html;
}

export function mountSharePages(app, clientDist) {
  const indexFile = path.join(clientDist, 'index.html');
  let template = null;
  const readTemplate = () => {
    if (template === null) template = fs.readFileSync(indexFile, 'utf8');
    return template;
  };

  const findListing = db.prepare(`
    SELECT id, title_en, title_vi, description_en, description_vi, price_vnd, district, image_path, images
    FROM listings WHERE id = ? AND status = 'published' AND is_seed = 0
  `);

  app.get('/listing/:id', (req, res, next) => {
    const row = findListing.get(req.params.id);
    if (!row) return next(); // unknown or not live: fall through to the normal page
    res.set('Cache-Control', 'public, max-age=300');
    res.type('html').send(renderListingHead(readTemplate(), listingMeta(row)));
  });

  const liveListings = db.prepare(`
    SELECT id, COALESCE(published_at, created_at) AS updated
    FROM listings WHERE status = 'published' AND is_seed = 0
    ORDER BY updated DESC LIMIT 5000
  `);

  app.get('/sitemap.xml', (req, res) => {
    const pages = ['/', '/browse', '/about', '/faq', '/contact']
      .map((p) => `  <url><loc>${SITE}${p}</loc></url>`);
    const listings = liveListings.all().map((r) =>
      `  <url><loc>${SITE}/listing/${encodeURIComponent(r.id)}</loc><lastmod>${String(r.updated).slice(0, 10)}</lastmod></url>`);
    res.set('Cache-Control', 'public, max-age=3600');
    res.type('application/xml').send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...pages, ...listings].join('\n')}\n</urlset>\n`,
    );
  });

  app.get('/robots.txt', (req, res) => {
    res.type('text/plain').send([
      'User-agent: *',
      'Disallow: /admin',
      'Disallow: /payment/',
      'Disallow: /messages',
      'Disallow: /saved',
      'Disallow: /api/',
      '',
      `Sitemap: ${SITE}/sitemap.xml`,
      '',
    ].join('\n'));
  });
}
