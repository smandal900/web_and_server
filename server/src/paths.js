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
export const PROFILE_DIR = path.join(DATA_DIR, 'profile');
export const PLACES_FILE = path.resolve(__dirname, '../geo/places.bin'); // offline place names, built by scripts/build-places.mjs
export const WEB_BUILD_DIR = path.resolve(__dirname, process.env.WEB_BUILD_DIR || '../../web/build');
export const PWA_BUILD_DIR = path.resolve(__dirname, process.env.PWA_BUILD_DIR || '../../pwa/build'); // the phone app, served at /app/

for (const dir of [LIBRARY_DIR, THUMB_DIR, TMP_DIR, PROFILE_DIR]) fs.mkdirSync(dir, { recursive: true });

export const THUMB_SIZES = {
  thumbnail: { px: 250, file: 'thumbnail.webp', mime: 'image/webp' },
  preview: { px: 1440 }, // its file name and type depend on the format, see PREVIEW_FORMATS
};

/** The formats a preview can be saved in (admin setting image.preview.format; webp is the default). */
export const PREVIEW_FORMATS = {
  webp: { file: 'preview.webp', mime: 'image/webp' },
  jpeg: { file: 'preview.jpg', mime: 'image/jpeg' },
};

/**
 * Every user has one folder, named by their user id, in both the library and the thumbs directory. A photo's
 * `original_path` is "<userId>/IMG_0001.jpg"; its thumbnails sit in the same folder under the same name without the
 * extension: "<userId>/IMG_0001_thumbnail.webp" and "<userId>/IMG_0001_preview.webp" (_preview.jpg when the preview format is jpeg). Uploads claim that name together
 * with the library file name (see claimLibraryName in assets.js), so two photos that differ only by extension
 * (IMG_0001.HEIC and IMG_0001.MOV) never share thumbnails.
 * A photo imported in place (absolute path) has no file in the library, so its thumbnails go to the owner's folder
 * under its id, which keeps them unique.
 * @param {{ id: string, owner_id?: string, original_path: string }} asset
 * @param {keyof typeof THUMB_SIZES} size
 * @param {keyof typeof PREVIEW_FORMATS} [format] only for previews
 */
export const thumbFile = (asset, size, format = 'webp') => {
  const { dir, name } = path.parse(asset.original_path);
  const inPlace = path.isAbsolute(asset.original_path);
  const folder = inPlace ? (asset.owner_id ?? '') : dir;
  return path.join(THUMB_DIR, folder, `${inPlace ? `${asset.id}_${name}` : name}_${size === 'preview' ? PREVIEW_FORMATS[format].file : THUMB_SIZES[size].file}`);
};

/** Deletes every thumbnail file of an asset, a preview in any format. */
export const removeThumbs = (asset) => {
  fs.rmSync(thumbFile(asset, 'thumbnail'), { force: true });
  for (const format of Object.keys(PREVIEW_FORMATS)) fs.rmSync(thumbFile(asset, 'preview', format), { force: true });
};
