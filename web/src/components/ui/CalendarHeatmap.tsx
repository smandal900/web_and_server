import { useMemo } from 'react';
import type { CalendarHeatmap as Heatmap } from '../../api/types';
import { t } from '../../i18n';

/** The last 53 weeks as a grid of small squares; a darker square means more pictures that day. */
export function CalendarHeatmap({ data }: { data?: Heatmap }) {
  const { weeks, max } = useMemo(() => {
    const counts = new Map((data?.series ?? []).map((s) => [s.date.slice(0, 10), s.count]));
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 52 * 7 - today.getDay()); // a Sunday, 52 weeks back
    const grid: Array<Array<{ date: string; count: number }>> = [];
    let highest = 0;
    for (let w = 0; w < 53; w++) {
      const week = [];
      for (let d = 0; d < 7; d++) {
        const day = new Date(start);
        day.setDate(start.getDate() + w * 7 + d);
        if (day > today) break;
        const key = day.toISOString().slice(0, 10);
        const count = counts.get(key) ?? 0;
        highest = Math.max(highest, count);
        week.push({ date: key, count });
      }
      grid.push(week);
    }
    return { weeks: grid, max: highest };
  }, [data]);

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-[3px]" role="img" aria-label={t('Activity over the last year')}>
        {weeks.map((week, i) => (
          <div key={i} className="flex flex-col gap-[3px]">
            {week.map((day) => (
              <span
                key={day.date}
                title={`${day.date}: ${day.count}`}
                className="size-3 rounded-sm bg-primary"
                style={{ opacity: day.count === 0 ? 0.1 : 0.3 + 0.7 * (day.count / max) }}
              />
            ))}
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">{t('{count} items in the last year', { count: data?.totalCount ?? 0 })}</p>
    </div>
  );
}
