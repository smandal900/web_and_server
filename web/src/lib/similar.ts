// "Similar photos" on the Photos page: shots taken close together that also look alike share one tile.
// Display only, nothing is changed on the server. (Stacks are the saved, hand-made version of this.)
import { thumbHashToRGBA } from 'thumbhash';
import type { TimelineAsset } from '../api/types';
import { groupByDay } from './dates';

/** A photo joins a group when it was taken this close to the previous one of the group... */
export const SIMILAR_GAP_SECONDS = 60;
/**
 * ...and differs this little from the group's first photo (mean difference per colour channel, 0-255, of the two
 * thumbhash previews). Measured on a phone camera folder: most quick re-takes are below 30, unrelated photos almost never.
 */
export const SIMILAR_MAX_DIFFERENCE = 30;

type Pixels = ReturnType<typeof thumbHashToRGBA>;
const cache = new Map<string, Pixels | null>();

function pixels(hash: string): Pixels | null {
  let value = cache.get(hash);
  if (value === undefined) {
    try {
      value = thumbHashToRGBA(Uint8Array.from(atob(hash), (c) => c.charCodeAt(0)));
    } catch {
      value = null;
    }
    cache.set(hash, value);
  }
  return value;
}

/** How different two pictures look; Infinity when it cannot be told or their shapes differ. */
export function hashDifference(a: string | null, b: string | null): number {
  const x = a ? pixels(a) : null;
  const y = b ? pixels(b) : null;
  if (!x || !y || x.w !== y.w || x.h !== y.h) return Infinity;
  let sum = 0;
  for (let i = 0; i < x.rgba.length; i += 4) for (let c = 0; c < 3; c++) sum += Math.abs(x.rgba[i + c] - y.rgba[i + c]);
  return sum / (x.w * x.h * 3);
}

/** Videos and hand-made stacks always keep their own tile. */
const canGroup = (a: TimelineAsset) => a.isImage && !a.stack && !a.livePhotoVideoId;
const seconds = (a: TimelineAsset) => Date.parse(a.fileCreatedAt) / 1000;

/** Split a list (in timeline order) into runs of similar photos. Most runs hold one picture. */
export function groupSimilar(assets: TimelineAsset[], difference = hashDifference): TimelineAsset[][] {
  const groups: TimelineAsset[][] = [];
  for (const asset of assets) {
    const group = groups[groups.length - 1];
    const previous = group?.[group.length - 1];
    if (
      previous &&
      canGroup(previous) &&
      canGroup(asset) &&
      previous.ownerId === asset.ownerId &&
      Math.abs(seconds(previous) - seconds(asset)) <= SIMILAR_GAP_SECONDS &&
      difference(group[0].thumbhash, asset.thumbhash) <= SIMILAR_MAX_DIFFERENCE
    ) {
      group.push(asset);
    } else groups.push([asset]);
  }
  return groups;
}

/** The picture shown for a group: a favorite if it has one, otherwise the first. */
export const coverOf = (group: TimelineAsset[]) => group.find((a) => a.isFavorite) ?? group[0];

/** The ids of the group (two or more) holding this picture, grouped the same way the grid does it (day by day). */
export function similarTo(assets: TimelineAsset[], id: string): string[] | undefined {
  const day = groupByDay(assets).find((d) => d.assets.some((a) => a.id === id));
  const group = day && groupSimilar(day.assets).find((g) => g.some((a) => a.id === id));
  return group && group.length > 1 ? group.map((a) => a.id) : undefined;
}
