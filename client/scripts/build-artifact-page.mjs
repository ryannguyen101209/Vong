/*
 * Converts the demo build's index.html into a page that satisfies the Claude
 * Artifact contract: no doctype/html/head/body wrapper (the platform supplies
 * one), asset paths relative with no leading "./", and a name-style <title>.
 *
 * Run after `npm run demo`. Output: dist-demo/artifact.html
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, '..', 'dist-demo');
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');

const js = html.match(/src="\.\/(assets\/[^"]+\.js)"/)?.[1];
const css = html.match(/href="\.\/(assets\/[^"]+\.css)"/)?.[1];
if (!js || !css) throw new Error('Could not find the built asset filenames in index.html');

const page = `<title>Vòng Marketplace</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="${css}">
<div id="root"></div>
<script type="module" src="${js}"></script>
`;

fs.writeFileSync(path.join(dist, 'artifact.html'), page);
console.log(`Wrote dist-demo/artifact.html (css: ${css}, js: ${js})`);
