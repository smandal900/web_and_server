// Small formatting helpers shared by many pages.

export function formatBytes(bytes: number | null | undefined, decimals = 1): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** i;
  return `${value.toFixed(i === 0 ? 0 : decimals)} ${units[i]}`;
}

/** Duration comes as milliseconds (this server) or "H:MM:SS.ffffff" text (Immich). */
export function durationToSeconds(duration: number | string | null | undefined): number {
  if (duration === null || duration === undefined) return 0;
  if (typeof duration === 'number') return duration / 1000;
  const parts = duration.split(':').map(Number);
  if (parts.some(Number.isNaN)) return 0;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

/** 83 -> "1:23", 3700 -> "1:01:40". */
export function formatDuration(duration: number | string | null | undefined): string {
  const total = Math.round(durationToSeconds(duration));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export const formatDate = (iso: string | null | undefined, options?: Intl.DateTimeFormatOptions) =>
  iso ? new Date(iso).toLocaleDateString(undefined, options ?? { year: 'numeric', month: 'short', day: 'numeric' }) : '';

export const formatDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';

/** "2 hours ago" style text. */
export function timeAgo(iso: string): string {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return rtf.format(-Math.round(seconds / size), unit);
  }
  return rtf.format(-Math.round(seconds), 'second');
}

/** "1,234" with the user's locale. */
export const formatNumber = (n: number) => n.toLocaleString();

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || '?';

export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
