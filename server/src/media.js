import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { THUMB_SIZES, TMP_DIR, thumbFile } from './paths.js';

// Re-exported so existing imports keep working.
export { LIBRARY_DIR, THUMB_DIR, TMP_DIR, THUMB_SIZES, thumbFile } from './paths.js';

// --- lazy heavy libraries ----------------------------------------------------
// sharp (libvips), exifr and thumbhash cost tens of MB. A worker that only serves files never loads them;
// the first call that really needs one pays the import, and the worker is stopped again when idle.
let sharpPromise;
const getSharp = () =>
  (sharpPromise ??= import('sharp').then(({ default: sharp }) => {
    // Keep memory low: no cache of decoded images, and one libvips thread per image.
    sharp.cache(false);
    sharp.concurrency(Number(process.env.SHARP_THREADS) || 1);
    return sharp;
  }));
let exifrPromise;
const getExifr = () => (exifrPromise ??= import('exifr').then((m) => m.default));
let thumbhashPromise;
const getThumbhash = () => (thumbhashPromise ??= import('thumbhash'));

// --- concurrency gate ---------------------------------------------------------
// Decoding images / running ffmpeg is where RAM spikes. Only MEDIA_JOBS run at once per process; the rest wait.
const MAX_JOBS = Math.max(1, Number(process.env.MEDIA_JOBS) || 1);
let running = 0;
const waiting = [];
async function gated(fn) {
  if (running >= MAX_JOBS) await new Promise((resolve) => waiting.push(resolve));
  running++;
  try {
    return await fn();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

const IMAGE_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
};
const VIDEO_TYPES = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/x-m4v',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.3gp': 'video/3gpp',
};

/** Extensions (with the leading dot) the web app is allowed to upload. */
export const MEDIA_EXTENSIONS = { image: Object.keys(IMAGE_TYPES), video: Object.keys(VIDEO_TYPES) };

/** @returns {{ type: 'IMAGE' | 'VIDEO', mime: string } | null} */
export function mediaInfoFor(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (IMAGE_TYPES[ext]) return { type: 'IMAGE', mime: IMAGE_TYPES[ext] };
  if (VIDEO_TYPES[ext]) return { type: 'VIDEO', mime: VIDEO_TYPES[ext] };
  return null;
}

export function sha1File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1');
    fs.createReadStream(filePath)
      .on('error', reject)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')));
  });
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true });
    const out = [];
    let err = '';
    child.stdout.on('data', (d) => out.push(d));
    child.stderr.on('data', (d) => (err = (err + d).slice(-2000)));
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0
        ? resolve(Buffer.concat(out))
        : reject(new Error(`${cmd} exited with ${code}: ${err.trim().split('\n').pop()}`)),
    );
  });
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const MIN_YEAR = 1990;
const plausible = (year) => year >= MIN_YEAR && year <= new Date().getUTCFullYear() + 1;
const pad = (n) => String(n).padStart(2, '0');

/** "2018:10:17 11:26:33" -> "2018-10-17T11:26:33", or null when missing or implausible. */
function wallClockFromExif(value) {
  const m = typeof value === 'string' && value.match(/^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  return m && plausible(+m[1]) && +m[2] >= 1 && +m[2] <= 12 ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}` : null;
}

/** Camera file names carry the local time: IMG_20181017_112633.jpg, VID_20231002_201520919.mp4 */
function wallClockFromName(name) {
  const m = name.match(/(?:^|\D)(\d{4})(\d{2})(\d{2})[_-]?(\d{2})(\d{2})(\d{2})/);
  if (m && plausible(+m[1]) && +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= 31 && +m[4] < 24) {
    return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
  }
  // WhatsApp/Facebook style: a millisecond epoch, e.g. FB_IMG_1550944211822.jpg
  const epoch = name.match(/(?:^|\D)(1\d{12})(?:\D|$)/)?.[1];
  if (epoch) {
    const d = new Date(Number(epoch));
    if (plausible(d.getUTCFullYear())) return d.toISOString().slice(0, 19);
  }
  return null;
}

function offsetMinutes(value) {
  const m = typeof value === 'string' && value.match(/^([+-])(\d{2}):?(\d{2})$/);
  return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
}

/** Build the three date fields stored for an asset from a local wall-clock time and its UTC offset. */
function datesFrom(wallClock, offsetMin) {
  return {
    localDateTime: `${wallClock}.000Z`,
    fileCreatedAt: new Date(Date.parse(`${wallClock}Z`) - offsetMin * 60_000).toISOString(),
    localOffsetHours: offsetMin / 60,
  };
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

const formatExposure = (t) => (typeof t !== 'number' ? null : t >= 1 ? String(t) : `1/${Math.round(1 / t)}`);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

async function readImage(filePath) {
  const [sharp, exifr] = await Promise.all([getSharp(), getExifr()]);
  const meta = await sharp(filePath, { failOn: 'none' }).metadata();
  const swap = (meta.orientation ?? 1) >= 5;
  const out = { width: (swap ? meta.height : meta.width) ?? null, height: (swap ? meta.width : meta.height) ?? null };

  let raw = {};
  try {
    raw = (await exifr.parse(filePath, { reviveValues: false, translateValues: false, gps: true })) ?? {};
  } catch {
    // no readable EXIF block; the file name and file times still give a date
  }

  const wall = wallClockFromExif(raw.DateTimeOriginal ?? raw.CreateDate);
  return {
    ...out,
    wallClock: wall,
    offsetMin: wall ? offsetMinutes(raw.OffsetTimeOriginal ?? raw.OffsetTime) : 0,
    exif: {
      make: raw.Make ?? null,
      model: raw.Model ?? null,
      lensModel: raw.LensModel ?? null,
      exposureTime: formatExposure(raw.ExposureTime),
      fNumber: num(raw.FNumber),
      iso: num(raw.ISO),
      focalLength: num(raw.FocalLength),
      orientation: raw.Orientation != null ? String(raw.Orientation) : null,
      latitude: num(raw.latitude),
      longitude: num(raw.longitude),
      description: typeof raw.ImageDescription === 'string' ? raw.ImageDescription.trim() || null : null,
      exifImageWidth: num(raw.ExifImageWidth) ?? out.width,
      exifImageHeight: num(raw.ExifImageHeight) ?? out.height,
    },
  };
}

async function readVideo(filePath) {
  const info = JSON.parse(
    (await run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', filePath])).toString(),
  );
  const stream = info.streams?.find((s) => s.codec_type === 'video');
  let width = stream?.width ?? null;
  let height = stream?.height ?? null;
  const rotation = Math.abs(Number(stream?.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? stream?.tags?.rotate ?? 0));
  if (rotation % 180 === 90) [width, height] = [height, width];

  const seconds = Number(info.format?.duration ?? stream?.duration);
  const created = info.format?.tags?.creation_time;
  return {
    width,
    height,
    durationMs: Number.isFinite(seconds) ? Math.round(seconds * 1000) : null,
    // the container stores UTC; only used when the file name has no local time
    wallClock: wallClockFromExif(typeof created === 'string' ? created.replace(/\.\d+Z?$/, '').replace('Z', '') : null),
    offsetMin: 0,
    exif: { exifImageWidth: width, exifImageHeight: height },
  };
}

/**
 * Read dimensions, duration, EXIF and the date taken.
 * Date priority: EXIF (photos) / file name (videos) / container time / the time the client reported.
 */
export async function readMetadata(filePath, { type, name, clientCreatedAt }) {
  const meta = await gated(() => (type === 'VIDEO' ? readVideo(filePath) : readImage(filePath)));
  const fromName = wallClockFromName(name);
  const wall = type === 'VIDEO' ? (fromName ?? meta.wallClock) : (meta.wallClock ?? fromName);
  const dates = wall
    ? datesFrom(wall, wall === meta.wallClock ? meta.offsetMin : 0)
    : datesFrom(clientCreatedAt.slice(0, 19), 0);
  return { ...meta, ...dates };
}

// ---------------------------------------------------------------------------
// Thumbnails
// ---------------------------------------------------------------------------

async function render(source, out, size) {
  const sharp = await getSharp();
  const { px } = THUMB_SIZES[size];
  await fsp.mkdir(path.dirname(out), { recursive: true });
  const img = sharp(source, { failOn: 'none', sequentialRead: true })
    .rotate()
    .resize({ width: px, height: px, fit: 'outside', withoutEnlargement: true });
  await (size === 'thumbnail' ? img.webp({ quality: 80 }) : img.jpeg({ quality: 80 })).toFile(out);
}

async function thumbhashOf(source) {
  const [sharp, { rgbaToThumbHash }] = await Promise.all([getSharp(), getThumbhash()]);
  const { data, info } = await sharp(source, { failOn: 'none' })
    .rotate()
    .resize(100, 100, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return Buffer.from(rgbaToThumbHash(info.width, info.height, data)).toString('base64');
}

async function extractFrame(videoPath, id, durationMs) {
  const frame = path.join(TMP_DIR, `${id}-frame.jpg`);
  for (const at of durationMs > 2000 ? ['1', '0'] : ['0']) {
    try {
      await run('ffmpeg', ['-y', '-v', 'error', '-ss', at, '-i', videoPath, '-frames:v', '1', '-vf', "scale='min(1920,iw)':-2", '-q:v', '3', frame]);
      if (fs.existsSync(frame)) return frame;
    } catch (error) {
      if (at === '0') throw error;
    }
  }
  throw new Error('no video frame could be extracted');
}

/**
 * Render the requested thumbnail sizes into the thumbs directory.
 * @returns {Promise<string | null>} the thumbhash, or null when it was not requested
 */
export const generateThumbnails = (job, sizes, withThumbhash) => gated(() => generate(job, sizes, withThumbhash));

async function generate({ id, type, filePath, durationMs }, sizes = ['thumbnail', 'preview'], withThumbhash = true) {
  const source = type === 'VIDEO' ? await extractFrame(filePath, id, durationMs) : filePath;
  try {
    for (const size of sizes) await render(source, thumbFile(id, size), size);
    return withThumbhash ? await thumbhashOf(source) : null;
  } finally {
    if (type === 'VIDEO') await fsp.rm(source, { force: true });
  }
}
