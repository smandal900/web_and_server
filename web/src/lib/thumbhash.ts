import { thumbHashToDataURL } from 'thumbhash';

const cache = new Map<string, string>();

/** Turn the server's base64 thumbhash into a small blurred image URL (cached). */
export function thumbhashUrl(hash: string | null | undefined): string | undefined {
  if (!hash) return undefined;
  let url = cache.get(hash);
  if (!url) {
    try {
      const bytes = Uint8Array.from(atob(hash), (c) => c.charCodeAt(0));
      url = thumbHashToDataURL(bytes);
      cache.set(hash, url);
    } catch {
      return undefined;
    }
  }
  return url;
}
