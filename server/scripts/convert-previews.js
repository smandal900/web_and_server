#!/usr/bin/env node
// Converts the previews that were saved in the other format (JPEG, the format before WebP became the default) to the
// format that is set now (System settings > Image settings > Preview format).
//
//   node scripts/convert-previews.js [--dry-run] [--limit N]
//
// This is optional: a preview in the other format is served as it is and nothing breaks. Converting makes the whole
// library use one format. It works on one photo at a time (low memory), recreates the preview from the original file,
// and deletes the old preview after the new one is written. Run it while the server is running or stopped.
import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { absolutePath } from '../src/assets.js';
import { closeDb, db } from '../src/db.js';
import { generateThumbnails } from '../src/media.js';
import { PREVIEW_FORMATS, thumbFile } from '../src/paths.js';
import { previewFormat } from '../src/system-config.js';

const { values } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, limit: { type: 'string' } } });
const limit = values.limit ? Number(values.limit) : Infinity;
const format = previewFormat();
const others = Object.keys(PREVIEW_FORMATS).filter((f) => f !== format);

const rows = db.prepare('SELECT id, owner_id, original_path, type, duration_ms, edits FROM assets ORDER BY rowid').all();
let converted = 0;
let failed = 0;
for (const row of rows) {
  const stale = others.some((o) => fs.existsSync(thumbFile(row, 'preview', o)));
  if (!stale || converted >= limit) continue;
  if (values['dry-run']) {
    console.log(`would convert ${row.original_path}`);
    converted++;
    continue;
  }
  try {
    await generateThumbnails(
      { id: row.id, ownerId: row.owner_id, originalPath: row.original_path, type: row.type, filePath: absolutePath(row), durationMs: row.duration_ms, edits: row.edits ? JSON.parse(row.edits) : null },
      ['preview'],
      false,
    ); // writes the preview in the current format and removes the one in the other format
    converted++;
  } catch (error) {
    failed++;
    console.warn(`could not convert ${row.original_path}: ${error.message}`);
  }
}
console.log(`${values['dry-run'] ? 'would convert' : 'converted'} ${converted} preview${converted === 1 ? '' : 's'} to ${format}${failed ? `, ${failed} failed` : ''}`);
closeDb();
