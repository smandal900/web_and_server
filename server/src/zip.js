// A tiny streaming zip writer (method "stored": photos and videos are already compressed, so deflate would only cost CPU).
// Memory stays at one 64 KB chunk no matter how large the files are. Classic zip only, so one archive stays under 4 GiB.
import fs from 'node:fs';
import { crc32 } from 'node:zlib';

const u16 = (n) => Buffer.from([n & 255, (n >> 8) & 255]);
const u32 = (n) => Buffer.from([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);

function dosDateTime(d) {
  const year = Math.max(1980, d.getFullYear());
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

const write = (out, chunk) =>
  new Promise((resolve, reject) => {
    if (out.destroyed) return reject(new Error('client went away'));
    out.write(chunk, (err) => (err ? reject(err) : resolve()));
  });

/** @param {{ name: string, file: string, date: Date }[]} entries @param {import('node:stream').Writable} out */
export async function streamZip(entries, out) {
  const central = [];
  let offset = 0;
  const send = async (buf) => {
    await write(out, buf);
    offset += buf.length;
  };

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const { time, date } = dosDateTime(entry.date);
    const headerOffset = offset;
    // bit 3: sizes and CRC follow the data; bit 11: the name is UTF-8
    await send(Buffer.concat([u32(0x04034b50), u16(20), u16(0x0808), u16(0), u16(time), u16(date), u32(0), u32(0), u32(0), u16(name.length), u16(0), name]));

    let crc = 0;
    let size = 0;
    for await (const chunk of fs.createReadStream(entry.file, { highWaterMark: 64 * 1024 })) {
      crc = crc32(chunk, crc);
      size += chunk.length;
      await send(chunk);
    }
    await send(Buffer.concat([u32(0x08074b50), u32(crc), u32(size), u32(size)]));
    central.push({ name, time, date, crc, size, headerOffset });
  }

  const centralStart = offset;
  for (const c of central) {
    await send(
      Buffer.concat([
        u32(0x02014b50), u16(20), u16(20), u16(0x0808), u16(0), u16(c.time), u16(c.date), u32(c.crc), u32(c.size), u32(c.size),
        u16(c.name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(c.headerOffset), c.name,
      ]),
    );
  }
  const centralSize = offset - centralStart;
  await send(Buffer.concat([u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length), u32(centralSize), u32(centralStart), u16(0)]));
  out.end();
}
