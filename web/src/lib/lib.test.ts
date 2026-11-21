import { describe, expect, it } from 'vitest';
import { chunkCount, chunkRange, missingChunks } from './chunks';
import { dayKey, formatMonth, groupByDay } from './dates';
import { durationToSeconds, formatBytes, formatDuration } from './format';
import { justifiedLayout, rowsHeight } from './justifiedLayout';
import { decodeFilters, encodeFilters, isEmptySearch, toRequest } from './search';
import { buildTree } from './tree';
import { zipBucket } from '../api/assets';
import { buildUrl } from '../api/client';
import { allEndpoints } from '../api/endpoints';

describe('justifiedLayout', () => {
  it('fills each full row to the container width', () => {
    const rows = justifiedLayout([1.5, 1.5, 1.5, 1.5, 1.5, 1.5], 900, 200, 2);
    for (const row of rows.slice(0, -1)) {
      const width = row.items.reduce((s, i) => s + i.width, 0) + 2 * (row.items.length - 1);
      expect(width).toBeCloseTo(900, 3);
    }
  });
  it('does not stretch the last row beyond the target height', () => {
    const rows = justifiedLayout([1.5, 1.5, 1.5, 1.5, 1.5], 900, 200, 2);
    expect(rows[rows.length - 1].height).toBeLessThanOrEqual(200);
  });
  it('keeps every item exactly once', () => {
    const rows = justifiedLayout(Array(37).fill(1.33), 1000, 235);
    expect(rows.flatMap((r) => r.items.map((i) => i.index))).toEqual([...Array(37).keys()]);
  });
  it('returns nothing for no width or no items', () => {
    expect(justifiedLayout([1], 0, 200)).toEqual([]);
    expect(justifiedLayout([], 500, 200)).toEqual([]);
    expect(rowsHeight([], 2)).toBe(0);
  });
});

describe('dates', () => {
  const a = { fileCreatedAt: '2024-05-17T23:30:00.000Z', localOffsetHours: 2 };
  it('uses the local offset to pick the day', () => expect(dayKey(a)).toBe('2024-05-18'));
  it('groups consecutive assets by day', () => {
    const asset = (id: string, at: string) => ({ id, fileCreatedAt: at, localOffsetHours: 0 }) as never;
    const groups = groupByDay([asset('1', '2024-01-02T10:00:00Z'), asset('2', '2024-01-02T09:00:00Z'), asset('3', '2024-01-01T09:00:00Z')]);
    expect(groups.map((g) => [g.day, g.assets.length])).toEqual([['2024-01-02', 2], ['2024-01-01', 1]]);
  });
  it('formats a month', () => expect(formatMonth('2024-05-01')).toMatch(/2024/));
});

describe('format', () => {
  it('formats bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1536)).toBe('1.5 KiB');
  });
  it('reads both duration styles', () => {
    expect(durationToSeconds(83_000)).toBe(83);
    expect(durationToSeconds('0:01:23.000000')).toBe(83);
    expect(formatDuration(3_700_000)).toBe('1:01:40');
    expect(formatDuration(5000)).toBe('0:05');
  });
});

describe('chunks', () => {
  it('plans chunks', () => {
    expect(chunkCount(25, 10)).toBe(3);
    expect(chunkRange(2, 25, 10)).toEqual({ start: 20, end: 25 });
    expect(missingChunks(5, [0, 2, 4])).toEqual([1, 3]);
  });
});

describe('zipBucket', () => {
  it('turns columns into rows', () => {
    const items = zipBucket({ id: ['a', 'b'], ratio: [1.5, 0], isImage: [true, false], isFavorite: [false, true], thumbhash: ['x', null] });
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ id: 'a', ratio: 1.5, isImage: true });
    expect(items[1]).toMatchObject({ id: 'b', ratio: 1, isImage: false, isFavorite: true, thumbhash: null });
  });
});

describe('search state', () => {
  it('round-trips through the URL', () => {
    const state = { text: 'beach', mode: 'filename' as const, personIds: ['1'] };
    expect(decodeFilters(decodeURIComponent(encodeFilters(state)))).toEqual(state);
  });
  it('maps the text mode to a request field', () => {
    expect(toRequest({ text: 'a', mode: 'filename' })).toEqual({ body: { originalFileName: 'a' }, smart: false });
    expect(toRequest({ text: 'a', mode: 'smart' })).toEqual({ body: { query: 'a' }, smart: true });
  });
  it('knows when nothing is filled in', () => {
    expect(isEmptySearch({ mode: 'smart' })).toBe(true);
    expect(isEmptySearch({ city: 'Paris' })).toBe(false);
  });
});

describe('tree', () => {
  it('nests paths and sorts them', () => {
    const tree = buildTree(['Trips/2024', 'Trips/2023', 'Family']);
    expect(tree.map((n) => n.name)).toEqual(['Family', 'Trips']);
    expect(tree[1].children.map((n) => n.path)).toEqual(['Trips/2023', 'Trips/2024']);
  });
});

describe('api', () => {
  it('builds urls with params and query', () => {
    expect(buildUrl('/assets/{id}/thumbnail', { id: 'a b' }, { size: 'preview', key: undefined })).toBe('/api/assets/a%20b/thumbnail?size=preview');
  });
  it('lists every endpoint with a valid support level', () => {
    const all = allEndpoints();
    expect(all.length).toBeGreaterThan(150);
    expect(all.every((e) => ['ok', 'stub', 'todo'].includes(e.support))).toBe(true);
  });
});
