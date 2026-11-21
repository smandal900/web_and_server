import { lazy, useState } from 'react';
import { Link } from 'react-router';
import { mdiAccountMultipleOutline, mdiEyeOutline, mdiShareVariantOutline } from '@mdi/js';
import { useInfiniteQuery } from '@tanstack/react-query';
import { personThumbnailUrl } from '../../api/assets';
import { getPeople } from '../../api/library';
import { Boundary } from '../../components/ui/Boundary';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Fields';
import { EmptyState } from '../../components/ui/Misc';
import { PageBody, PageHeader } from '../../components/ui/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { t } from '../../i18n';

const PersonAccessModal = lazy(() => import('../../components/modals/PersonAccessModal'));
const PAGE = 500;

/** Everyone the face recognition found, as round pictures. */
export default function People() {
  const [search, setSearch] = useState('');
  const [sharing, setSharing] = useState(false);
  const people = useInfiniteQuery({
    queryKey: ['people', 'list'],
    queryFn: ({ pageParam }) => getPeople({ page: pageParam, size: PAGE, withHidden: false }),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (last.hasNextPage ? pages.length + 1 : undefined),
  });
  const all = people.data?.pages.flatMap((p) => p.people) ?? [];
  const named = all.filter((p) => !p.isHidden && p.name.toLowerCase().includes(search.toLowerCase()));
  // People without a name come last, like in the original app.
  const shown = [...named.filter((p) => p.name), ...named.filter((p) => !p.name)];

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t('People')}>
        <Button variant="ghost" icon={mdiShareVariantOutline} onClick={() => setSharing(true)}>
          <span className="max-md:hidden">{t('Share people')}</span>
        </Button>
        <Link to="/people/manage">
          <Button variant="ghost" icon={mdiEyeOutline}>
            <span className="max-md:hidden">{t('Show & hide people')}</span>
          </Button>
        </Link>
      </PageHeader>
      <PageBody>
        {people.isLoading && <PageSpinner />}
        {!people.isLoading && all.length === 0 && (
          <EmptyState icon={mdiAccountMultipleOutline} title={t('No people yet')} text={t('When face recognition runs on your photos, the people it finds appear here.')} />
        )}
        {all.length > 0 && (
          <>
            <div className="mb-4 max-w-sm">
              <TextField placeholder={t('Search people')} value={search} onChange={setSearch} />
            </div>
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
              {shown.map((p) => (
                <Link key={p.id} to={`/people/${p.id}`} className="group flex flex-col items-center gap-2 text-center">
                  <img src={personThumbnailUrl(p.id)} alt="" loading="lazy" className="aspect-square w-full rounded-full bg-panel object-cover transition group-hover:scale-105" />
                  <span className="w-full truncate text-sm font-medium">{p.name || <span className="text-muted">{t('Add a name')}</span>}</span>
                </Link>
              ))}
            </div>
            {people.hasNextPage && (
              <div className="mt-6 flex justify-center">
                <Button variant="outline" loading={people.isFetchingNextPage} onClick={() => people.fetchNextPage()}>
                  {t('Load more')}
                </Button>
              </div>
            )}
          </>
        )}
      </PageBody>
      <Boundary compact fallback={null}>
        {sharing && <PersonAccessModal people={all} onClose={() => setSharing(false)} />}
      </Boundary>
    </div>
  );
}
