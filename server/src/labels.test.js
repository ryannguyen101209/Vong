// Every category, district and condition the server accepts has a label in
// both languages, and the offline demo offers the same categories.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CATEGORIES, DISTRICTS, CONDITIONS } from './seed-data.js';
import en from '../../client/src/i18n/en.js';
import vi from '../../client/src/i18n/vi.js';

assert.ok(CATEGORIES.includes('sports'));
for (const [name, dict] of [['en', en], ['vi', vi]]) {
  for (const key of CATEGORIES) assert.ok(dict.categories[key], `${name} label for category ${key}`);
  for (const key of DISTRICTS) assert.ok(dict.districts[key], `${name} label for district ${key}`);
  for (const key of CONDITIONS) assert.ok(dict.conditions[key], `${name} label for condition ${key}`);
}
assert.equal(vi.categories.sports, 'Thể thao');
assert.equal(en.categories.sports, 'Sports');

const demo = fs.readFileSync(new URL('../../client/src/lib/api.demo.js', import.meta.url), 'utf8');
assert.deepEqual(JSON.parse(/const CATEGORIES = (\[[^\]]*\])/.exec(demo)[1].replace(/'/g, '"')), CATEGORIES, 'demo categories match the server');

console.log('label tests passed');
