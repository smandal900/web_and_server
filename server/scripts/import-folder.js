#!/usr/bin/env node
// Bulk-import a folder of photos and videos into the library, without the browser.
//
//   node scripts/import-folder.js <folder> --user <email> [--mode reference|copy] [--recursive]
//                                 [--concurrency 2] [--limit N] [--dry-run]
//
//   --mode reference  (default) leave the files where they are; the library points at them. Uses no extra space
//                     for originals, but the files must stay in place.
//   --mode copy       copy the files into the server's library folder (needs free disk space for all of them).
//
// Uses the same ingest code as the web upload, so metadata, thumbnails and duplicate detection behave the same.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { ingestAsset } from '../src/assets.js';
import { db, closeDb, DATA_DIR } from '../src/db.js';
import { mediaInfoFor } from '../src/media.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    user: { type: 'string' },
    mode: { type: 'string', default: 'reference' },
    recursive: { type: 'boolean', default: false },
    concurrency: { type: 'string', default: '2' },
    limit: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
});

const fail = (message) => {
  console.error(message);
  closeDb();
  process.exit(1);
};

const folder = positionals[0];
if (!folder || !values.user) fail('Usage: node scripts/import-folder.js <folder> --user <email> [--mode reference|copy] [--recursive] [--dry-run]');
if (!['reference', 'copy'].includes(values.mode)) fail('--mode must be "reference" or "copy"');

const user = db.prepare('SELECT id, email FROM users WHERE email = ? AND deleted_at IS NULL').get(values.user);
if (!user) fail(`No user with email ${values.user}`);

async function* walk(dir) {
  for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (values.recursive) yield* walk(full);
    } else if (mediaInfoFor(entry.name)) {
      yield full;
    }
  }
}

const files = [];
const limit = values.limit ? Number(values.limit) : Infinity;
for await (const file of walk(path.resolve(folder))) {
  if (files.length >= limit) break;
  files.push({ file, size: (await fsp.stat(file)).size });
}
const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
const gib = (n) => (n / 1024 ** 3).toFixed(2);
console.log(`Found ${files.length} media files (${gib(totalBytes)} GiB) in ${folder}`);

if (values.mode === 'copy') {
  const { bavail, bsize } = fs.statfsSync(DATA_DIR);
  const free = bavail * bsize;
  console.log(`Free space for the library: ${gib(free)} GiB`);
  // leave room for thumbnails and the database as well
  if (totalBytes * 1.05 > free) fail(`Not enough free space to copy ${gib(totalBytes)} GiB. Use --mode reference, or free up space.`);
}

if (values['dry-run']) {
  console.log('Dry run: nothing was imported.');
  closeDb();
  process.exit(0);
}

const counts = { created: 0, duplicate: 0, failed: 0 };
const failures = [];
let done = 0;
let next = 0;
const started = Date.now();

async function worker() {
  while (next < files.length) {
    const { file } = files[next++];
    try {
      const stat = await fsp.stat(file);
      const result = await ingestAsset({
        ownerId: user.id,
        filePath: file,
        originalName: path.basename(file),
        mode: values.mode,
        fileCreatedAt: stat.mtime.toISOString(),
        fileModifiedAt: stat.mtime.toISOString(),
      });
      counts[result.duplicate ? 'duplicate' : 'created']++;
    } catch (error) {
      counts.failed++;
      failures.push(`${path.basename(file)}: ${error.message}`);
    }
    done++;
    if (done % 25 === 0 || done === files.length) {
      const rate = done / ((Date.now() - started) / 1000);
      console.log(`${done}/${files.length}  created ${counts.created}, duplicates ${counts.duplicate}, failed ${counts.failed}  (${rate.toFixed(1)} files/s)`);
    }
  }
}

await Promise.all(Array.from({ length: Math.max(1, Number(values.concurrency) || 2) }, worker));

console.log(`\nDone in ${((Date.now() - started) / 1000).toFixed(0)}s: ${counts.created} imported, ${counts.duplicate} already present, ${counts.failed} failed.`);
for (const line of failures.slice(0, 20)) console.log(`  failed: ${line}`);
closeDb();
