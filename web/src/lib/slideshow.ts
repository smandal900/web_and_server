export interface SlideshowSettings {
  /** Seconds each picture stays on screen. */
  delay: number;
  order: 'asc' | 'desc' | 'shuffle';
  loop: boolean;
  showMetadata: boolean;
}

export const DEFAULT_SLIDESHOW: SlideshowSettings = { delay: 5, order: 'asc', loop: true, showMetadata: false };
const KEY = 'slideshow-settings';

export function loadSlideshowSettings(): SlideshowSettings {
  try {
    return { ...DEFAULT_SLIDESHOW, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return DEFAULT_SLIDESHOW;
  }
}
export function saveSlideshowSettings(settings: SlideshowSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

/** The order the pictures play in, starting from `currentId`. */
export function slideshowOrder(ids: string[], currentId: string, order: SlideshowSettings['order']): string[] {
  if (order === 'shuffle') {
    const rest = ids.filter((id) => id !== currentId);
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    return [currentId, ...rest];
  }
  const sequence = order === 'desc' ? [...ids].reverse() : ids;
  const start = Math.max(0, sequence.indexOf(currentId));
  return [...sequence.slice(start), ...sequence.slice(0, start)];
}
