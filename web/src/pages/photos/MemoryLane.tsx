import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { thumbnailUrl } from '../../api/assets';
import { getMemories } from '../../api/library';
import { t } from '../../i18n';

/** A strip of "on this day" cards above the photos. Renders nothing when there are no memories. */
export default function MemoryLane() {
  const memories = useQuery({ queryKey: ['memories'], queryFn: getMemories, retry: false, staleTime: 5 * 60_000 });
  const items = (memories.data ?? []).filter((m) => m.assets.length > 0);
  if (items.length === 0) return null;

  return (
    <div className="flex gap-3 overflow-x-auto px-4 py-3">
      {items.map((memory) => {
        const years = new Date().getFullYear() - memory.data.year;
        return (
          <Link key={memory.id} to={`/memories/${memory.id}`} className="group relative h-40 w-28 shrink-0 overflow-hidden rounded-2xl bg-panel md:h-48 md:w-36">
            <img src={thumbnailUrl(memory.assets[0].id)} alt="" loading="lazy" className="size-full object-cover transition group-hover:scale-105" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-sm font-medium text-white">
              {years <= 0 ? t('This year') : t('{count} years ago', { count: years })}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
