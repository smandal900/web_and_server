// Runs in a Web Worker: computes the SHA-1 of a (possibly huge) file without loading it into memory.
// The server uses the hex SHA-1 to spot duplicates. crypto.subtle cannot hash a stream, so we hash
// the file block by block with a small pure-JS implementation.
import { sha1 } from '@noble/hashes/legacy.js';
import { bytesToHex } from '@noble/hashes/utils.js';

const BLOCK = 4 * 1024 * 1024;

self.onmessage = async (event: MessageEvent<{ id: string; file: File }>) => {
  const { id, file } = event.data;
  try {
    const hash = sha1.create();
    for (let offset = 0; offset < file.size; offset += BLOCK) {
      hash.update(new Uint8Array(await file.slice(offset, offset + BLOCK).arrayBuffer()));
    }
    (self as unknown as Worker).postMessage({ id, checksum: bytesToHex(hash.digest()) });
  } catch (error) {
    (self as unknown as Worker).postMessage({ id, error: String(error) });
  }
};
