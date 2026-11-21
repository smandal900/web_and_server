// Planning chunked uploads: which chunk indexes still need to be sent.

export const chunkCount = (size: number, chunkSize: number) => Math.ceil(size / chunkSize);

/** Byte range of one chunk of a file. */
export function chunkRange(index: number, size: number, chunkSize: number) {
  const start = index * chunkSize;
  return { start, end: Math.min(size, start + chunkSize) };
}

/** Chunk indexes the server has not received yet. */
export function missingChunks(total: number, received: number[]): number[] {
  const have = new Set(received);
  return Array.from({ length: total }, (_, i) => i).filter((i) => !have.has(i));
}

/** Files above this size use the resumable chunked upload; smaller ones use one request. */
export const CHUNKED_THRESHOLD = 25 * 1024 * 1024;
