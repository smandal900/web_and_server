import { Link } from 'react-router';
import { mdiTimerSand } from '@mdi/js';
import { useQuery } from '@tanstack/react-query';
import { thumbnailUrl } from '../../api/assets';
import { getMemories } from '../../api/library';
import { EmptyState } from '../../components/ui/Misc';
import { PageBody, PageHeader } from '../../components/ui/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { t } from '../../i18n';

/** All memories, one card per "years ago". Opening a card plays it as a story. */
export default function Memories() {
  const memories = useQuery({ queryKey: ['memories'], queryFn: getMemories, retry: false });
  const items = (memories.data ?? []).filter((m) => m.assets.length > 0);
  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t('Memories')} />
      <PageBody>
        {memories.isLoading && <PageSpinner />}
        {!memories.isLoading && items.length === 0 && (
          <EmptyState icon={mdiTimerSand} title={t('No memories yet')} text={t('Memories bring back photos from this day in earlier years.')} />
        )}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {items.map((m) => {
            const years = new Date().getFullYear() - m.data.year;
            return (
              <Link key={m.id} to={`/memories/${m.id}`} className="group relative aspect-[3/4] overflow-hidden rounded-2xl bg-panel">
                <img src={thumbnailUrl(m.assets[0].id)} alt="" loading="lazy" className="size-full object-cover transition group-hover:scale-105" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-white">
                  <p className="font-medium">{years <= 0 ? t('This year') : t('{count} years ago', { count: years })}</p>
                  <p className="text-xs text-white/80">{t('{count} items', { count: m.assets.length })}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </PageBody>
    </div>
  );
}
