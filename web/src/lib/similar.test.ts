import { describe, expect, it } from 'vitest';
import { rgbaToThumbHash } from 'thumbhash';
import type { TimelineAsset } from '../api/types';
import { coverOf, groupSimilar, hashDifference, similarTo } from './similar';

/** A thumbhash of a plain picture of one grey level. */
const hash = (level: number, w = 40, h = 30) => {
  const rgba = new Uint8Array(w * h * 4).map((_, i) => (i % 4 === 3 ? 255 : level));
  return btoa(String.fromCharCode(...rgbaToThumbHash(w, h, rgba)));
};
const photo = (id: string, second: number, over: Partial<TimelineAsset> = {}): TimelineAsset => ({
  id,
  ownerId: 'u',
  fileCreatedAt: new Date(Date.UTC(2024, 0, 1, 12, 0, 0) - second * 1000).toISOString(),
  localOffsetHours: 0,
  ratio: 1.5,
  thumbhash: hash(100),
  isImage: true,
  isFavorite: false,
  isTrashed: false,
  duration: null,
  livePhotoVideoId: null,
  projectionType: null,
  visibility: 'timeline',
  stack: null,
  ...over,
});
const ids = (list: TimelineAsset[]) => groupSimilar(list).map((g) => g.map((a) => a.id).join('+'));

describe('similar photos', () => {
  it('measures how different two previews look', () => {
    expect(hashDifference(hash(100), hash(100))).toBe(0);
    expect(hashDifference(hash(100), hash(110))).toBeLessThanOrEqual(30);
    expect(hashDifference(hash(100), hash(200))).toBeGreaterThan(30);
    expect(hashDifference(hash(100), hash(100, 30, 40))).toBe(Infinity); // portrait against landscape
    expect(hashDifference(hash(100), null)).toBe(Infinity);
    expect(hashDifference(hash(100), 'not base64 !')).toBe(Infinity);
  });
  it('groups quick shots that look alike', () => {
    expect(ids([photo('a', 0), photo('b', 4), photo('c', 9)])).toEqual(['a+b+c']);
  });
  it('splits on a long pause, a different picture, or another owner', () => {
    expect(ids([photo('a', 0), photo('b', 61)])).toEqual(['a', 'b']);
    expect(ids([photo('a', 0), photo('b', 2, { thumbhash: hash(220) })])).toEqual(['a', 'b']);
    expect(ids([photo('a', 0), photo('b', 2, { ownerId: 'partner' })])).toEqual(['a', 'b']);
  });
  it('compares with the first photo, so a group cannot drift into another scene', () => {
    expect(ids([photo('a', 0), photo('b', 1, { thumbhash: hash(120) }), photo('c', 2, { thumbhash: hash(140) })])).toEqual(['a+b', 'c']);
  });
  it('never groups videos or hand-made stacks', () => {
    expect(ids([photo('a', 0, { isImage: false }), photo('b', 1, { isImage: false })])).toEqual(['a', 'b']);
    expect(ids([photo('a', 0, { stack: ['s', 2] }), photo('b', 1)])).toEqual(['a', 'b']);
  });
  it('shows a favorite as the cover', () => {
    expect(coverOf([photo('a', 0), photo('b', 1, { isFavorite: true })]).id).toBe('b');
    expect(coverOf([photo('a', 0), photo('b', 1)]).id).toBe('a');
  });
  it('finds the group of the photo open in the viewer', () => {
    const list = [photo('a', 0), photo('b', 3), photo('c', 500)];
    expect(similarTo(list, 'b')).toEqual(['a', 'b']);
    expect(similarTo(list, 'c')).toBeUndefined();
  });
});
