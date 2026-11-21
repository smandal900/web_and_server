import { useCallback, useEffect, useRef, useState } from 'react';
import type { TimelineBucket } from '../../api/types';
import { formatMonth, monthId } from '../../lib/dates';
import { cx } from '../../lib/cx';

/**
 * A thin month index on the right edge, like a fast-scroll handle.
 * Click or drag to jump to a month; it also shows where you are while you scroll normally.
 * Each month gets height in proportion to its picture count (with a small minimum).
 */
export default function Scrubber({ buckets, scrollRoot }: { buckets: TimelineBucket[]; scrollRoot: HTMLElement | null }) {
  const track = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0); // index of the month at the top of the screen
  const [hover, setHover] = useState<{ index: number; y: number } | null>(null);
  const dragging = useRef(false);

  const total = buckets.reduce((s, b) => s + b.count, 0) || 1;
  const min = total / buckets.length / 3;
  const weights = buckets.map((b) => Math.max(b.count, min));
  const weightSum = weights.reduce((a, b) => a + b, 0);

  // Track which month is at the top while the user scrolls.
  useEffect(() => {
    if (!scrollRoot) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const top = scrollRoot.getBoundingClientRect().top;
      const sections = scrollRoot.querySelectorAll<HTMLElement>('[data-month]');
      let index = 0;
      sections.forEach((s, i) => s.getBoundingClientRect().top - top <= 80 && (index = i));
      setCurrent(index);
    };
    const onScroll = () => !frame && (frame = requestAnimationFrame(update));
    scrollRoot.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => {
      scrollRoot.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [scrollRoot, buckets]);

  const indexAt = useCallback(
    (clientY: number) => {
      const rect = track.current!.getBoundingClientRect();
      const target = ((clientY - rect.top) / rect.height) * weightSum;
      let acc = 0;
      for (let i = 0; i < weights.length; i++) {
        acc += weights[i];
        if (target <= acc) return i;
      }
      return weights.length - 1;
    },
    [weights, weightSum],
  );

  const jump = (index: number) => {
    const el = document.getElementById(monthId(buckets[index].timeBucket));
    if (el && scrollRoot) scrollRoot.scrollTop += el.getBoundingClientRect().top - scrollRoot.getBoundingClientRect().top;
  };

  if (buckets.length < 2) return null;

  let acc = 0;
  let lastYear = '';
  return (
    <div
      ref={track}
      className="absolute top-2 right-0 bottom-2 z-20 w-14 cursor-pointer touch-none select-none max-md:w-8"
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        jump(indexAt(e.clientY));
      }}
      onPointerMove={(e) => {
        const index = indexAt(e.clientY);
        setHover({ index, y: e.clientY - track.current!.getBoundingClientRect().top });
        if (dragging.current) jump(index);
      }}
      onPointerUp={() => (dragging.current = false)}
      onPointerLeave={() => !dragging.current && setHover(null)}
      role="slider"
      aria-label="Jump to date"
      aria-valuenow={current}
    >
      {buckets.map((b, i) => {
        const top = (acc / weightSum) * 100;
        acc += weights[i];
        const year = b.timeBucket.slice(0, 4);
        const showYear = year !== lastYear;
        lastYear = year;
        return (
          <div key={b.timeBucket} className="absolute right-0 left-0" style={{ top: `${top}%`, height: `${(weights[i] / weightSum) * 100}%` }}>
            {showYear && <span className="absolute right-3 -translate-y-1/2 text-[10px] text-muted max-md:hidden">{year}</span>}
            <span className={cx('absolute right-0 h-px w-2 bg-muted/50', i === current && 'w-4 bg-primary')} />
          </div>
        );
      })}
      {hover && (
        <div className="pointer-events-none absolute right-6 -translate-y-1/2 rounded-md bg-primary px-2 py-1 text-xs whitespace-nowrap text-on-primary shadow" style={{ top: hover.y }}>
          {formatMonth(buckets[hover.index].timeBucket)}
        </div>
      )}
    </div>
  );
}
