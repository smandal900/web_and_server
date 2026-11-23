// Builds geo/places.bin, the offline place-name list the server uses to turn GPS coordinates into city / state / country.
//
// Source: GeoNames (https://www.geonames.org), licensed CC BY 4.0. Download these three files from
// https://download.geonames.org/export/dump/ (unzip cities500.zip) into one folder and run:
//
//   node scripts/build-places.mjs <folder with cities500.txt, admin1CodesASCII.txt, countryInfo.txt>
//
// File layout (little endian), read by src/geocode.js:
//   header        20 bytes   "PLC1", places, regions, strings, string bytes (u32 each)
//   cellStart     (64800 + 1) * u32   first place of every 1 x 1 degree cell; places are sorted by cell
//   regions       regions * 8 bytes   state string, country string (u32 each, index into the string table)
//   places        places * 14 bytes   latitude, longitude (i32, degrees * 1e5), city string (u32), region (u16)
//   stringOffsets (strings + 1) * u32
//   stringData    UTF-8
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: node scripts/build-places.mjs <folder with the GeoNames files>');
  process.exit(1);
}
const lines = (file) => fs.readFileSync(path.join(dir, file), 'utf8').split('\n').filter((l) => l && !l.startsWith('#'));

const countries = new Map(); // ISO code -> name
for (const line of lines('countryInfo.txt')) {
  const c = line.split('\t');
  countries.set(c[0], c[4]);
}
const admin1 = new Map(); // "IN.10" -> name
for (const line of lines('admin1CodesASCII.txt')) {
  const c = line.split('\t');
  admin1.set(c[0], c[1]);
}

const strings = [];
const stringIndex = new Map();
const str = (s) => {
  let i = stringIndex.get(s);
  if (i === undefined) {
    i = strings.length;
    strings.push(s);
    stringIndex.set(s, i);
  }
  return i;
};
const regions = [];
const regionIndex = new Map();
const region = (state, country) => {
  const key = `${state}\u0000${country}`;
  let i = regionIndex.get(key);
  if (i === undefined) {
    i = regions.length;
    regions.push([str(state), str(country)]);
    regionIndex.set(key, i);
  }
  return i;
};

const cellOf = (lat, lon) => {
  const row = Math.min(179, Math.max(0, Math.floor(lat) + 90));
  const col = Math.min(359, Math.max(0, Math.floor(lon) + 180));
  return row * 360 + col;
};

const places = [];
for (const line of lines('cities500.txt')) {
  const c = line.split('\t');
  const lat = Number(c[4]);
  const lon = Number(c[5]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
  const code = c[8];
  places.push({
    cell: cellOf(lat, lon),
    lat: Math.round(lat * 1e5),
    lon: Math.round(lon * 1e5),
    city: str(c[1]),
    region: region(admin1.get(`${code}.${c[10]}`) ?? '', countries.get(code) ?? code),
  });
}
places.sort((a, b) => a.cell - b.cell);
if (regions.length > 65535) throw new Error('too many regions for a u16');

const CELLS = 180 * 360;
const cellStart = new Uint32Array(CELLS + 1);
for (const p of places) cellStart[p.cell + 1]++;
for (let i = 0; i < CELLS; i++) cellStart[i + 1] += cellStart[i];

const encoded = strings.map((s) => Buffer.from(s, 'utf8'));
const offsets = new Uint32Array(strings.length + 1);
encoded.forEach((b, i) => (offsets[i + 1] = offsets[i] + b.length));

const head = Buffer.alloc(20);
head.write('PLC1', 0, 'latin1');
head.writeUInt32LE(places.length, 4);
head.writeUInt32LE(regions.length, 8);
head.writeUInt32LE(strings.length, 12);
head.writeUInt32LE(offsets[strings.length], 16);

const regionBytes = Buffer.alloc(regions.length * 8);
regions.forEach(([s, c], i) => {
  regionBytes.writeUInt32LE(s, i * 8);
  regionBytes.writeUInt32LE(c, i * 8 + 4);
});
const placeBytes = Buffer.alloc(places.length * 14);
places.forEach((p, i) => {
  const at = i * 14;
  placeBytes.writeInt32LE(p.lat, at);
  placeBytes.writeInt32LE(p.lon, at + 4);
  placeBytes.writeUInt32LE(p.city, at + 8);
  placeBytes.writeUInt16LE(p.region, at + 12);
});

const out = path.resolve(import.meta.dirname, '../geo/places.bin');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(
  out,
  Buffer.concat([head, Buffer.from(cellStart.buffer), regionBytes, placeBytes, Buffer.from(offsets.buffer), ...encoded]),
);
console.log(`${places.length} places, ${regions.length} regions, ${strings.length} strings -> ${out} (${(fs.statSync(out).size / 1048576).toFixed(1)} MiB)`);
