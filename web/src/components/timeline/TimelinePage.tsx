import type { ReactNode } from 'react';
import { PageHeader } from '../ui/PageHeader';
import { Timeline, type TimelineProps } from './Timeline';

/** Page header + a Timeline that fills the rest. Most picture pages are just this with different filters. */
export function TimelinePage({ title, headerActions, banner, ...timeline }: { title: ReactNode; headerActions?: ReactNode; banner?: ReactNode } & TimelineProps) {
  return (
    <div className="flex h-full flex-col">
      <PageHeader title={title}>{headerActions}</PageHeader>
      {banner}
      <div className="min-h-0 flex-1">
        <Timeline {...timeline} />
      </div>
    </div>
  );
}
