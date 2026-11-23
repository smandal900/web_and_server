// One-shot job started by the gateway: gives photos and videos that have GPS coordinates but no place yet their city /
// state / country (items uploaded before place names existed, or imported by other means), then exits.
// New uploads get their position and place when they are stored (assets.js), so this normally finds nothing to do.
//
//  1. Videos stored before their position was read: the GPS tag is read from the file (ffprobe) and saved. A video
//     that has none gets latitude: null, which is what stops it being read again.
//  2. Everything with a position and no city: the nearest place is looked up.
//     - An item that was never looked at has no "city" key at all. It is always written (null when no place is
//       near), and that key is what marks it as looked at.
//     - An item that has the key but no value (open sea, or a video whose position was read after it was stored)
//       is looked up again but written only when a place is found, so a run that finds nothing new writes nothing.
import path from 'node:path';
import { closeDb, db } from '../db.js';
import { placeFields, releasePlaces } from '../geocode.js';
import { readVideoPosition } from '../media.js';
import { LIBRARY_DIR } from '../paths.js';

const BATCH = 500;
const VIDEO_BATCH = 50;

const nextVideos = db.prepare(
  `SELECT id, original_path FROM assets WHERE type = 'VIDEO' AND json_type(exif, '$.latitude') IS NULL ORDER BY rowid LIMIT ?`,
);
const savePosition = db.prepare(`UPDATE assets SET exif = json_set(exif, '$.latitude', ?, '$.longitude', ?) WHERE id = ?`);
const saveNoPosition = db.prepare(`UPDATE assets SET exif = json_set(exif, '$.latitude', NULL, '$.longitude', NULL) WHERE id = ?`);

const next = db.prepare(
  `SELECT rowid AS rid, id, json_type(exif, '$.city') AS marked, json_extract(exif, '$.latitude') AS lat, json_extract(exif, '$.longitude') AS lon
   FROM assets
   WHERE json_extract(exif, '$.latitude') IS NOT NULL AND json_extract(exif, '$.longitude') IS NOT NULL
     AND json_extract(exif, '$.city') IS NULL AND rowid > ? ORDER BY rowid LIMIT ?`,
);
const save = db.prepare(`UPDATE assets SET exif = json_set(exif, '$.city', ?, '$.state', ?, '$.country', ?) WHERE id = ?`);

const inTransaction = (work) => {
  db.exec('BEGIN');
  try {
    work();
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
};

try {
  let videos = 0;
  let found = 0;
  let unreadable = 0;
  for (;;) {
    const rows = nextVideos.all(VIDEO_BATCH);
    if (!rows.length) break;
    const positions = [];
    for (const row of rows) {
      const file = path.isAbsolute(row.original_path) ? row.original_path : path.join(LIBRARY_DIR, row.original_path);
      let position = null;
      try {
        position = await readVideoPosition(file); // one ffprobe at a time; no database transaction is open meanwhile
      } catch {
        unreadable++; // missing or damaged file: marked as looked at, like a video without GPS
      }
      positions.push([row.id, position]);
    }
    inTransaction(() => {
      for (const [id, position] of positions) {
        if (position) savePosition.run(position.latitude, position.longitude, id);
        else saveNoPosition.run(id);
      }
    });
    videos += rows.length;
    found += positions.filter(([, p]) => p).length;
  }
  if (videos) console.log(`[places] read the GPS position of ${videos} video${videos === 1 ? '' : 's'}: ${found} have one${unreadable ? `, ${unreadable} could not be read` : ''}`);

  let checked = 0;
  let named = 0;
  let after = 0;
  for (;;) {
    const rows = next.all(after, BATCH);
    if (!rows.length) break;
    after = rows[rows.length - 1].rid;
    inTransaction(() => {
      for (const row of rows) {
        const place = placeFields(row.lat, row.lon);
        if (place.city === null && row.marked !== null) continue; // looked at before and still no place: nothing to write
        save.run(place.city, place.state, place.country, row.id);
        checked++;
        if (place.city !== null) named++;
      }
    });
  }
  if (checked) console.log(`[places] looked up the place of ${checked} item${checked === 1 ? '' : 's'}: ${named} named`);
} catch (error) {
  console.warn(`[places] could not name places: ${error.message}`);
  process.exitCode = 1;
} finally {
  releasePlaces();
  closeDb();
}
