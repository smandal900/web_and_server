// Offline reverse geocoding: GPS coordinates -> the nearest known place (city, state, country).
//
// The data is geo/places.bin (built from GeoNames by scripts/build-places.mjs, see its header for the layout): about
// 237,000 places of 500+ inhabitants in a 6 MiB file. It is read into one Buffer the first time a place is needed
// (outside the V8 heap) and looked up in place; nothing is parsed into objects. Photos are sorted into 1 x 1 degree
// cells, so a lookup only reads the few cells around the point.
//
// Place names are GeoNames data, CC BY 4.0 (https://www.geonames.org).
import fs from 'node:fs';
import { PLACES_FILE } from './paths.js';

const COLS = 360;
const CELLS = 180 * COLS;
const RECORD = 14;
const MAX_KM = 100; // a photo further than this from every known place gets no place name (open sea, polar regions)

let file; // undefined = not loaded yet, null = not available
let idle; // timer that gives the memory back when the places have not been used for a while
const KEEP_MS = 30_000;

function load() {
  if (file !== undefined) return file;
  try {
    const buf = fs.readFileSync(PLACES_FILE);
    if (buf.toString('latin1', 0, 4) !== 'PLC1') throw new Error('not a places file');
    const places = buf.readUInt32LE(4);
    const regions = buf.readUInt32LE(8);
    const strings = buf.readUInt32LE(12);
    const cellAt = 20;
    const regionsAt = cellAt + (CELLS + 1) * 4;
    const placesAt = regionsAt + regions * 8;
    const offsetsAt = placesAt + places * RECORD;
    file = { buf, cellAt, regionsAt, placesAt, offsetsAt, textAt: offsetsAt + (strings + 1) * 4 };
  } catch (error) {
    console.warn(`[geocode] place names are not available (${error.message}); run scripts/build-places.mjs`);
    file = null;
  }
  return file;
}

const text = (f, i) => {
  const from = f.buf.readUInt32LE(f.offsetsAt + i * 4);
  const to = f.buf.readUInt32LE(f.offsetsAt + (i + 1) * 4);
  return f.buf.toString('utf8', f.textAt + from, f.textAt + to);
};

/** Gives the memory of the place list back (the next lookup loads it again). */
export function releasePlaces() {
  clearTimeout(idle);
  file = undefined;
}

/**
 * The nearest place within 100 km, or null.
 * @returns {{ city: string, state: string | null, country: string } | null}
 */
export function placeAt(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const f = load();
  if (!f) return null;
  clearTimeout(idle);
  idle = setTimeout(releasePlaces, KEEP_MS);
  idle.unref();

  const row = Math.min(179, Math.floor(lat) + 90);
  const col = (((Math.floor(lon) + 180) % COLS) + COLS) % COLS;
  const cos = Math.max(0.05, Math.cos((lat * Math.PI) / 180));
  const colSpan = Math.min(60, Math.ceil(MAX_KM / (111.32 * cos))); // degrees of longitude are narrower near the poles

  let best = MAX_KM * MAX_KM;
  let bestAt = -1;
  for (let r = Math.max(0, row - 1); r <= Math.min(179, row + 1); r++) {
    for (let dc = -colSpan; dc <= colSpan; dc++) {
      const cell = r * COLS + ((col + dc + COLS) % COLS);
      const end = f.buf.readUInt32LE(f.cellAt + (cell + 1) * 4);
      for (let i = f.buf.readUInt32LE(f.cellAt + cell * 4); i < end; i++) {
        const at = f.placesAt + i * RECORD;
        let dLon = f.buf.readInt32LE(at + 4) / 1e5 - lon;
        if (dLon > 180) dLon -= 360;
        else if (dLon < -180) dLon += 360;
        const dy = (f.buf.readInt32LE(at) / 1e5 - lat) * 110.57;
        const dx = dLon * 111.32 * cos;
        const d = dx * dx + dy * dy;
        if (d < best) {
          best = d;
          bestAt = at;
        }
      }
    }
  }
  if (bestAt < 0) return null;
  const regionAt = f.regionsAt + f.buf.readUInt16LE(bestAt + 12) * 8;
  return {
    city: text(f, f.buf.readUInt32LE(bestAt + 8)),
    state: text(f, f.buf.readUInt32LE(regionAt)) || null,
    country: text(f, f.buf.readUInt32LE(regionAt + 4)),
  };
}

/** The place fields stored with a photo (exif.city / state / country); all null when there is no GPS or no place near it. */
export function placeFields(latitude, longitude) {
  const place = latitude == null || longitude == null ? null : placeAt(latitude, longitude);
  return { city: place?.city ?? null, state: place?.state ?? null, country: place?.country ?? null };
}
