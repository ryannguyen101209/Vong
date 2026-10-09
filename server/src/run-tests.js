/**
 * Runs every src/*.test.js file, one at a time, each in its own process (they
 * set environment variables and open their own database before importing the
 * app). Stops at the first failure. A new test file needs no registration here.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const files = fs.readdirSync(here).filter((name) => name.endsWith('.test.js')).sort();

for (const file of files) {
  const result = spawnSync(process.execPath, [path.join(here, file)], { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`\n${file} failed`);
    process.exit(result.status ?? 1);
  }
}
console.log(`\nall ${files.length} test files passed`);
