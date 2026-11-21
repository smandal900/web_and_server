import { memo, useEffect, useMemo, useRef } from 'react';
import { mdiCheckCircle, mdiCircleOutline } from '@mdi/js';
import type { TimelineAsset, TimelineBucket } from '../../api/types';
import { formatDayHeading, formatMonth, groupByDay, monthId } from '../../lib/dates';
import { cx } from '../../lib/cx';
import { Icon } from '../ui/Icon';
import { GAP, AssetGrid, rowHeightFor } from './AssetGrid';
import { fromTimeline } from './gridAsset';
import { useSelectionContext } from './selection';

const DAY_HEADER = 44;
/** A month counts as "near" within this distance of the screen. Smaller = less memory, larger = fewer blank flashes. */
const NEAR_MARGIN = '120% 0px 120% 0px';
/** Fast scrolling or dragging the scrubber passes many months; only ones that stay near this long are loaded. */
const SETTLE_MS = 150;

/** Guess a month's pixel height before its pictures are loaded, so the scrollbar is right from the start. */
export function estimateMonthHeight(count: number, width: number) {
  const rowHeight = rowHeightFor(width);
  const perRow = Math.max(1, Math.floor(width / (rowHeight * 1.3)));
  const days = Math.min(count, 8);
  return Math.ceil(count / perRow) * (rowHeight + GAP) + days * DAY_HEADER;
}

function DaySection({ day, assets, width, shareKey, onOpen, selectable }: { day: string; assets: TimelineAsset[]; width: number; shareKey?: string; onOpen: (id: string) => void; selectable: boolean }) {
  const selection = useSelectionContext();
  const grid = useMemo(() => assets.map(fromTimeline), [assets]);
  const ids = useMemo(() => assets.map((a) => a.id), [assets]);
  const allSelected = !!selection && ids.every((id) => selection.has(id));

  return (
    <section>
      <h3 className="group sticky top-0 z-10 flex h-11 items-center gap-2 bg-bg/95 pr-2 text-sm font-medium backdrop-blur-sm">
        {selectable && selection && (
          <button
            aria-label={allSelected ? 'Unselect day' : 'Select day'}
            onClick={() => selection.setMany(ids, !allSelected)}
            className={cx('text-muted transition hover:text-primary', allSelected ? 'text-primary opacity-100' : 'opacity-0 group-hover:opacity-100', selection.active && 'opacity-100')}
          >
            <Icon path={allSelected ? mdiCheckCircle : mdiCircleOutline} size={20} />
          </button>
        )}
        {formatDayHeading(day)}
      </h3>
      <AssetGrid assets={grid} width={width} shareKey={shareKey} onOpen={onOpen} selectable={selectable} />
    </section>
  );
}

interface MonthSectionProps {
  bucket: TimelineBucket;
  width: number;
  assets?: TimelineAsset[];
  failed?: boolean;
  scrollRoot: HTMLElement | null;
  /** The month has been near the screen for a moment: the parent loads it. */
  onNear: (timeBucket: string) => void;
  /** The month left the neighbourhood of the screen: the parent may drop its data to save memory. */
  onFar: (timeBucket: string) => void;
  onOpen: (id: string) => void;
  shareKey?: string;
  selectable?: boolean;
}

/**
 * One month. Only months near the screen hold pictures (data, DOM and <img> elements); every other month is an
 * empty box of the right height. Scrolling away from a month frees it; scrolling back reloads it.
 */
export const MonthSection = memo(function MonthSection({ bucket, width, assets, failed, scrollRoot, onNear, onFar, onOpen, shareKey, selectable = true }: MonthSectionProps) {
  const box = useRef<HTMLElement>(null);
  const loaded = !!assets;
  const measured = useRef<number | undefined>(undefined); // real height while loaded, reused as the placeholder height after unloading

  useEffect(() => {
    if (!scrollRoot || !box.current) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const near = entries[entries.length - 1].isIntersecting;
        clearTimeout(timer);
        if (near) timer = setTimeout(() => onNear(bucket.timeBucket), SETTLE_MS);
        else {
          if (box.current && box.current.dataset.loaded === 'true') measured.current = box.current.offsetHeight;
          onFar(bucket.timeBucket);
        }
      },
      { root: scrollRoot, rootMargin: NEAR_MARGIN },
    );
    observer.observe(box.current);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [scrollRoot, bucket.timeBucket, onNear, onFar]);

  const groups = useMemo(() => (assets ? groupByDay(assets) : []), [assets]);

  return (
    <section
      ref={box}
      id={monthId(bucket.timeBucket)}
      data-month={bucket.timeBucket}
      data-loaded={loaded}
      style={loaded ? undefined : { height: measured.current ?? estimateMonthHeight(bucket.count, width) }}
    >
      {loaded ? (
        groups.map((g) => <DaySection key={g.day} day={g.day} assets={g.assets} width={width} shareKey={shareKey} onOpen={onOpen} selectable={selectable} />)
      ) : (
        <div className="pt-3">
          <p className="text-sm font-medium text-muted">{failed ? 'Could not load this month' : formatMonth(bucket.timeBucket)}</p>
        </div>
      )}
    </section>
  );
});
