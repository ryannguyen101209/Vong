/*
 * Seed listings need photos, and a demo with broken image boxes looks broken.
 * These are hand-drawn flat illustrations in the Vong palette, written to
 * uploads/seed/ at seed time. Replace the files with real photos whenever you
 * have them -- nothing else in the app cares what the file is.
 */
import fs from 'node:fs';
import path from 'node:path';
import { UPLOADS_DIR } from './db.js';

const NAVY = '#0A2947';
const BEIGE = '#F3E4C9';
const SAGE = '#D3D4C0';
const BROWN = '#8B5E3C';
const CREAM = '#FBF3E4';

/** Shared chrome: warm ground, soft horizon, grain. Art is drawn on top. */
function frame(bg, art) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900" role="img">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${CREAM}"/><stop offset="1" stop-color="${bg}"/>
    </linearGradient>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3"/>
      <feColorMatrix type="saturate" values="0"/></filter>
  </defs>
  <rect width="1200" height="900" fill="url(#g)"/>
  <ellipse cx="600" cy="700" rx="430" ry="90" fill="${SAGE}" opacity="0.5"/>
  <g fill="none" stroke="${NAVY}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round">
    ${art}
  </g>
  <rect width="1200" height="900" filter="url(#grain)" opacity="0.06"/>
</svg>`;
}

const ART = {
  // Two teak dining chairs, three-quarter view.
  'teak-chairs': frame(BEIGE, `
    <g transform="translate(330 250)">
      <path d="M40 40 h150 v210 M40 40 v210" stroke="${BROWN}"/>
      <path d="M50 95 h130 M50 150 h130" stroke="${BROWN}"/>
      <path d="M10 250 h210 l-20 40 h-170 z" fill="${BROWN}" stroke="${BROWN}"/>
      <path d="M20 290 v130 M210 290 v130 M50 300 v120 M180 300 v120" stroke="${BROWN}"/>
    </g>
    <g transform="translate(640 300) scale(0.9)" opacity="0.85">
      <path d="M40 40 h150 v210 M40 40 v210" stroke="${BROWN}"/>
      <path d="M50 95 h130 M50 150 h130" stroke="${BROWN}"/>
      <path d="M10 250 h210 l-20 40 h-170 z" fill="${BROWN}" stroke="${BROWN}"/>
      <path d="M20 290 v130 M210 290 v130 M50 300 v120 M180 300 v120" stroke="${BROWN}"/>
    </g>`),

  // Study desk with a small shelf and a lamp.
  'study-desk': frame(BEIGE, `
    <path d="M250 430 h700 v40 h-700 z" fill="${BROWN}" stroke="${BROWN}"/>
    <path d="M290 470 v250 M910 470 v250"/>
    <path d="M620 470 h290 v130 h-290 z" fill="${CREAM}"/>
    <path d="M660 505 h60 M660 555 h60"/>
    <g stroke="${NAVY}"><path d="M380 430 v-110 l90 -70"/><path d="M470 350 l70 40 -50 45 -70 -40 z" fill="${SAGE}"/></g>
    <path d="M300 430 v-60 h120" stroke="${SAGE}"/>`),

  // Denim jacket on a hanger.
  'denim-jacket': frame(SAGE, `
    <path d="M600 200 v50" stroke="${NAVY}"/>
    <path d="M600 200 a30 30 0 1 1 0.1 0" stroke="${NAVY}"/>
    <path d="M420 300 h360 l-40 60 v40 l40 20 v240 h-360 v-240 l40 -20 v-40 z" fill="${NAVY}" opacity="0.85" stroke="${NAVY}"/>
    <path d="M600 300 v360" stroke="${BEIGE}"/>
    <path d="M500 330 h60 v70 h-60 z M640 330 h60 v70 h-60 z" stroke="${BEIGE}"/>
    <path d="M420 360 l-80 40 v210 h80 z M780 360 l80 40 v210 h-80 z" fill="${NAVY}" opacity="0.85" stroke="${NAVY}"/>
    <circle cx="600" cy="420" r="8" fill="${BEIGE}" stroke="none"/>
    <circle cx="600" cy="500" r="8" fill="${BEIGE}" stroke="none"/>
    <circle cx="600" cy="580" r="8" fill="${BEIGE}" stroke="none"/>`),

  // Folded stack of linen shirts.
  'linen-shirts': frame(BEIGE, `
    <g stroke="${NAVY}">
      <path d="M380 560 h440 v90 h-440 z" fill="${CREAM}"/>
      <path d="M400 470 h400 v90 h-400 z" fill="${SAGE}"/>
      <path d="M420 380 h360 v90 h-360 z" fill="${CREAM}"/>
      <path d="M560 380 l40 45 40 -45"/>
      <path d="M380 605 h440 M400 515 h400"/>
    </g>
    <path d="M330 650 h540" stroke="${BROWN}"/>`),

  // DSLR camera, front view.
  'dslr-camera': frame(SAGE, `
    <path d="M330 340 h540 a40 40 0 0 1 40 40 v230 a40 40 0 0 1 -40 40 h-540 a40 40 0 0 1 -40 -40 v-230 a40 40 0 0 1 40 -40 z" fill="${NAVY}"/>
    <path d="M500 280 h200 v60 h-200 z" fill="${NAVY}" stroke="${NAVY}"/>
    <circle cx="600" cy="495" r="130" fill="${BEIGE}" stroke="${NAVY}"/>
    <circle cx="600" cy="495" r="80" fill="${SAGE}" stroke="${NAVY}"/>
    <circle cx="600" cy="495" r="34" fill="${NAVY}" stroke="${NAVY}"/>
    <circle cx="370" cy="400" r="16" fill="${BROWN}" stroke="none"/>
    <path d="M760 390 h70" stroke="${BEIGE}"/>`),

  // Tablet with a stand.
  'tablet': frame(BEIGE, `
    <path d="M400 230 h400 a30 30 0 0 1 30 30 v430 a30 30 0 0 1 -30 30 h-400 a30 30 0 0 1 -30 -30 v-430 a30 30 0 0 1 30 -30 z" fill="${NAVY}"/>
    <path d="M420 280 h360 v340 h-360 z" fill="${CREAM}" stroke="none"/>
    <circle cx="600" cy="660" r="16" fill="${BEIGE}" stroke="none"/>
    <path d="M470 400 h220 M470 460 h160 M470 520 h200" stroke="${SAGE}"/>
    <path d="M830 720 l120 -60" stroke="${BROWN}"/>`),

  // Stack of study books with a bookmark.
  'study-books': frame(SAGE, `
    <g stroke="${NAVY}">
      <path d="M340 580 h520 v70 h-520 z" fill="${BROWN}"/>
      <path d="M370 510 h460 v70 h-460 z" fill="${CREAM}"/>
      <path d="M350 440 h500 v70 h-500 z" fill="${BEIGE}"/>
      <path d="M420 300 h360 v140 h-360 z" fill="${CREAM}"/>
      <path d="M600 300 v140"/>
      <path d="M460 350 h90 M650 350 h90 M460 395 h90 M650 395 h90" stroke="${SAGE}"/>
    </g>
    <path d="M720 300 v90 l25 -25 25 25 v-90" fill="${BROWN}" stroke="${BROWN}"/>`),

  // Row of paperbacks on a shelf.
  'paperbacks': frame(BEIGE, `
    <g stroke="${NAVY}">
      <path d="M400 320 h70 v330 h-70 z" fill="${BROWN}"/>
      <path d="M480 350 h60 v300 h-60 z" fill="${CREAM}"/>
      <path d="M550 300 h80 v350 h-80 z" fill="${SAGE}"/>
      <path d="M640 360 h55 v290 h-55 z" fill="${CREAM}"/>
      <path d="M705 330 h75 v320 h-75 z" fill="${NAVY}"/>
      <path d="M790 380 l90 30 -80 240 -90 -30 z" fill="${BROWN}"/>
    </g>
    <path d="M340 650 h560" stroke="${BROWN}"/>
    <path d="M425 400 v60 M580 380 v70 M730 420 v60" stroke="${BEIGE}"/>`),

  // Rice cooker.
  'rice-cooker': frame(SAGE, `
    <path d="M370 420 h460 v200 a60 60 0 0 1 -60 60 h-340 a60 60 0 0 1 -60 -60 z" fill="${CREAM}"/>
    <path d="M350 360 h500 a20 20 0 0 1 20 30 l-10 30 h-520 l-10 -30 a20 20 0 0 1 20 -30 z" fill="${NAVY}" stroke="${NAVY}"/>
    <path d="M560 320 h80 v40 h-80 z" fill="${NAVY}" stroke="${NAVY}"/>
    <path d="M450 490 h180 v90 h-180 z" fill="${BEIGE}"/>
    <path d="M480 525 h120 M480 555 h80" stroke="${SAGE}"/>
    <circle cx="720" cy="520" r="22" fill="${BROWN}" stroke="${NAVY}"/>
    <path d="M600 300 c-40 -40 40 -60 0 -100" stroke="${BROWN}"/>`),

  // Acoustic guitar.
  'guitar': frame(BEIGE, `
    <g stroke="${BROWN}">
      <path d="M600 300 c110 0 150 90 150 150 c0 60 -40 90 -40 140 c0 80 -50 140 -110 140 c-60 0 -110 -60 -110 -140 c0 -50 -40 -80 -40 -140 c0 -60 40 -150 150 -150 z" fill="${CREAM}"/>
      <circle cx="600" cy="500" r="55" fill="${BEIGE}"/>
      <path d="M540 620 h120 v25 h-120 z" fill="${BROWN}"/>
    </g>
    <path d="M575 300 v-120 h50 v120 z" fill="${BROWN}" stroke="${BROWN}"/>
    <path d="M570 180 h60 v-60 h-60 z" fill="${NAVY}" stroke="${NAVY}"/>
    <g stroke="${NAVY}" stroke-width="4">
      <path d="M585 130 v500 M600 130 v500 M615 130 v500"/>
    </g>`),
};

/** Write every illustration to uploads/seed/ and return slug -> public path. */
export function writePlaceholders() {
  const dir = path.join(UPLOADS_DIR, 'seed');
  fs.mkdirSync(dir, { recursive: true });
  const paths = {};
  for (const [slug, svg] of Object.entries(ART)) {
    fs.writeFileSync(path.join(dir, `${slug}.svg`), svg, 'utf8');
    paths[slug] = `/uploads/seed/${slug}.svg`;
  }
  return paths;
}
