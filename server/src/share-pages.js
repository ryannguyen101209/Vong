import fs from 'node:fs';
import path from 'node:path';
import { db } from './db.js';
import { CATEGORIES, DISTRICTS as DISTRICT_KEYS } from './seed-data.js';

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

const CATEGORY_NAMES = {
  furniture: 'Nội thất', clothing: 'Quần áo', electronics: 'Đồ điện tử', books: 'Sách',
  household: 'Đồ gia dụng', sports: 'Đồ thể thao', hobby: 'Đồ sở thích',
};
// schema.org item conditions, for Google's product results.
const CONDITION_SCHEMA = {
  like_new: 'https://schema.org/UsedCondition', good: 'https://schema.org/UsedCondition',
  fair: 'https://schema.org/UsedCondition', well_used: 'https://schema.org/UsedCondition',
};
const districtName = (key) => DISTRICTS.vi[key] || DISTRICTS.shared[key] || '';

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
  const url = `${SITE}/listing/${encodeURIComponent(row.id)}`;
  const image = coverImage(row);
  return {
    title: `${headline} | Vòng`,
    ogTitle: headline,
    description: shorten(description, 180),
    url,
    image,
    imageAlt: title,
    // Lets Google show the price and that it is secondhand in search results.
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: title,
      description: shorten(description, 500),
      image: [image],
      ...(CATEGORY_NAMES[row.category] ? { category: CATEGORY_NAMES[row.category] } : {}),
      offers: {
        '@type': 'Offer',
        url,
        price: Math.round(Number(row.price_vnd) || 0),
        priceCurrency: 'VND',
        itemCondition: CONDITION_SCHEMA[row.condition] || 'https://schema.org/UsedCondition',
        availability: row.status === 'sold' ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
        ...(district ? { availableAtOrFrom: { '@type': 'Place', name: `${district}, TP. Hồ Chí Minh` } } : {}),
      },
    },
  };
}

/** Title and description for a category and/or district page, or null if neither is known. */
export function browseMeta(category, district) {
  const cat = CATEGORY_NAMES[category] ? category : '';
  const dist = DISTRICT_KEYS.includes(district) ? district : '';
  if (!cat && !dist) return null;
  const what = cat ? CATEGORY_NAMES[cat] : 'Đồ cũ';
  const where = dist ? districtName(dist) : 'Sài Gòn';
  const params = new URLSearchParams();
  if (cat) params.set('category', cat);
  if (dist) params.set('district', dist);
  const lowerWhat = cat ? `${what.charAt(0).toLowerCase()}${what.slice(1)} cũ` : 'đồ cũ';
  return {
    title: `${what}${cat ? ' cũ' : ''} ở ${where} | Vòng`,
    ogTitle: `${what}${cat ? ' cũ' : ''} ở ${where}`,
    description: `Mua bán ${lowerWhat} ở ${where}, TP. Hồ Chí Minh. Xem ảnh thật, giá rõ ràng, nhắn người bán trực tiếp trên Vòng. Không hoa hồng.`,
    url: `${SITE}/browse?${params.toString()}`,
    image: `${SITE}/og-image.png`,
    imageAlt: 'Vòng',
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
  // In a JSON block, "<" is escaped so text from a listing can never close the <script> tag.
  const ld = meta.jsonLd
    ? `\n    <script type="application/ld+json">${JSON.stringify(meta.jsonLd).replace(/</g, '\\u003c')}</script>`
    : '';
  set(/\n(\s*)<\/head>/, (m, indent) => `\n${indent}  <link rel="canonical" href="${u}" />${ld}\n${indent}</head>`);
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
    SELECT id, title_en, title_vi, description_en, description_vi, price_vnd, district, category, condition, status, image_path, images
    FROM listings WHERE id = ? AND status = 'published' AND is_seed = 0
  `);

  app.get('/listing/:id', (req, res, next) => {
    const row = findListing.get(req.params.id);
    if (!row) return next(); // unknown or not live: fall through to the normal page
    res.set('Cache-Control', 'public, max-age=300');
    res.type('html').send(renderListingHead(readTemplate(), listingMeta(row)));
  });

  // Category and district pages get their own title, so each can be found on Google.
  app.get('/browse', (req, res, next) => {
    const meta = browseMeta(String(req.query.category ?? ''), String(req.query.district ?? ''));
    if (!meta) return next();
    res.set('Cache-Control', 'public, max-age=300');
    res.type('html').send(renderListingHead(readTemplate(), meta).replace('<meta property="og:type" content="product" />', '<meta property="og:type" content="website" />'));
  });

  const liveListings = db.prepare(`
    SELECT id, COALESCE(published_at, created_at) AS updated
    FROM listings WHERE status = 'published' AND is_seed = 0
    ORDER BY updated DESC LIMIT 5000
  `);

  app.get('/sitemap.xml', (req, res) => {
    const pages = ['/', '/browse', '/about', '/faq', '/contact', '/rules', '/terms', '/privacy']
      .map((p) => `  <url><loc>${SITE}${p}</loc></url>`);
    // Only categories and districts that have something for sale, so no empty pages are listed.
    const live = db.prepare("SELECT DISTINCT category, district FROM listings WHERE status = 'published' AND is_seed = 0").all();
    const browse = [
      ...new Set(live.map((r) => r.category).filter((c) => CATEGORY_NAMES[c]).map((c) => `category=${c}`)),
      ...new Set(live.map((r) => r.district).filter((d) => DISTRICT_KEYS.includes(d)).map((d) => `district=${d}`)),
    ].map((q) => `  <url><loc>${SITE}/browse?${q.replace('&', '&amp;')}</loc></url>`);
    const listings = liveListings.all().map((r) =>
      `  <url><loc>${SITE}/listing/${encodeURIComponent(r.id)}</loc><lastmod>${String(r.updated).slice(0, 10)}</lastmod></url>`);
    res.set('Cache-Control', 'public, max-age=3600');
    res.type('application/xml').send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...pages, ...browse, ...listings].join('\n')}\n</urlset>\n`,
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
