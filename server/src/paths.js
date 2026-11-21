// Folder layout. Pure path maths + mkdir: no heavy imports, so every worker can load it for free.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DB_PATH = path.resolve(__dirname, process.env.DB_PATH || '../data/immich-web.db');
export const DATA_DIR = path.dirname(DB_PATH);
export const LIBRARY_DIR = path.join(DATA_DIR, 'library');
export const THUMB_DIR = path.join(DATA_DIR, 'thumbs');
export const TMP_DIR = path.join(DATA_DIR, 'tmp');
export const CHUNK_DIR = path.join(TMP_DIR, 'chunked');
export const WEB_BUILD_DIR = path.resolve(__dirname, process.env.WEB_BUILD_DIR || '../../web/build');

for (const dir of [LIBRARY_DIR, THUMB_DIR, TMP_DIR, CHUNK_DIR]) fs.mkdirSync(dir, { recursive: true });

export const THUMB_SIZES = {
  thumbnail: { px: 250, file: 'thumbnail.webp', mime: 'image/webp' },
  preview: { px: 1440, file: 'preview.jpg', mime: 'image/jpeg' },
};

export const thumbFile = (id, size) => path.join(THUMB_DIR, id.slice(0, 2), id, THUMB_SIZES[size].file);
