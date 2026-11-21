import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { getTimelineBucket, getTimelineBuckets, zipBucket } from '../api/assets';
import type { TimelineAsset, TimelineBucket, TimelineQuery } from '../api/types';

/** The list of months (with counts) for a set of filters. */
export function useTimelineBuckets(query: TimelineQuery, enabled = true) {
  return useQuery({
    queryKey: ['timeline', 'buckets', query],
    queryFn: ({ signal }) => getTimelineBuckets(query, signal),
    enabled,
    staleTime: 30_000,
  });
}

/**
 * The pictures of every month in `requested` (months that were near the screen at some point).
 * Returns data per month and one flat, ordered list that the viewer uses for previous/next.
 */
export function useTimelineMonths(requested: string[], query: TimelineQuery, buckets: TimelineBucket[]) {
  const results = useQueries({
    queries: requested.map((timeBucket) => ({
      queryKey: ['timeline', 'bucket', timeBucket, query],
      queryFn: ({ signal }: { signal: AbortSignal }) => getTimelineBucket(timeBucket, query, signal).then(zipBucket),
      staleTime: 30_000,
      gcTime: 45_000, // a month that left the screen is forgotten after 45 s (scrolling back soon is still instant)
    })),
  });

  const byMonth = useMemo(() => {
    const map = new Map<string, { assets?: TimelineAsset[]; error?: Error }>();
    requested.forEach((month, i) => map.set(month, { assets: results[i]?.data, error: results[i]?.error ?? undefined }));
    return map;
  }, [requested, results]);

  const ordered = useMemo(
    () => buckets.flatMap((b) => byMonth.get(b.timeBucket)?.assets ?? []),
    [buckets, byMonth],
  );
  return { byMonth, ordered };
}
