// Downloading originals. One file = a plain link. Several = a zip from the server, or one by one if the
// server cannot build zips yet.
import { downloadArchive, originalUrl, saveFile } from '../api/assets';
import { NotSupportedError } from '../api/client';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** @returns 'zip' | 'single' | 'each' so the caller can tell the user what happened. */
export async function downloadAssets(ids: string[], key?: string): Promise<'zip' | 'single' | 'each'> {
  if (ids.length === 1) {
    saveFile(originalUrl(ids[0], key), ''); // empty name: the browser uses the server's file name
    return 'single';
  }
  try {
    const blob = await downloadArchive(ids);
    const url = URL.createObjectURL(blob);
    saveFile(url, 'photos.zip');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return 'zip';
  } catch (error) {
    if (!(error instanceof NotSupportedError)) throw error;
    for (const id of ids) {
      saveFile(originalUrl(id, key), '');
      await wait(400); // browsers drop downloads that start too quickly
    }
    return 'each';
  }
}
