// Grouping a timeline by day and month.
import type { TimelineAsset } from '../api/types';

/** The calendar day a picture belongs to, as the photographer saw it ("2024-05-17"). */
export function dayKey(asset: Pick<TimelineAsset, 'fileCreatedAt' | 'localOffsetHours'>): string {
  const local = new Date(new Date(asset.fileCreatedAt).getTime() + (asset.localOffsetHours ?? 0) * 3_600_000);
  return local.toISOString().slice(0, 10);
}

export interface DayGroup {
  day: string;
  assets: TimelineAsset[];
}

/** Assets are already sorted by the server; keep that order and start a new group when the day changes. */
export function groupByDay(assets: TimelineAsset[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const asset of assets) {
    const day = dayKey(asset);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.assets.push(asset);
    else groups.push({ day, assets: [asset] });
  }
  return groups;
}

/** "Fri, May 17, 2024" (the day is a plain date, so parse it as UTC to avoid shifting). */
export function formatDayHeading(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** "May 2024" from a bucket key like "2024-05-01". */
export function formatMonth(timeBucket: string): string {
  return new Date(`${timeBucket.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export const monthId = (timeBucket: string) => `month-${timeBucket.slice(0, 7)}`;
