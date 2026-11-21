import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { mdiMagnify } from '@mdi/js';
import { useInfiniteQuery } from '@tanstack/react-query';
import { searchAssets } from '../../api/library';
import { AlbumCard } from '../../components/albums/AlbumCard';
import { AssetListView } from '../../components/timeline/AssetListView';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/Misc';
import { PageHeader } from '../../components/ui/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { t } from '../../i18n';
import { decodeFilters, isEmptySearch, toRequest } from '../../lib/search';
import { useAuth } from '../../state/AuthProvider';

/** Results of a search. The filters live in the address (?filters=...), see lib/search.ts. */
export default function Search() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const state = useMemo(() => decodeFilters(params.get('filters')), [params]);
  const request = useMemo(() => toRequest(state), [state]);
  const empty = isEmptySearch(state);

  const results = useInfiniteQuery({
    queryKey: ['search', request],
    enabled: !empty,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => searchAssets({ ...request.body, page: pageParam, size: 100 }, request.smart),
    getNextPageParam: (last) => (last.assets.nextPage ? Number(last.assets.nextPage) : undefined),
    retry: false,
  });
  const assets = results.data?.pages.flatMap((p) => p.assets.items) ?? [];
  const albums = results.data?.pages[0]?.albums?.items ?? [];
  const total = results.data?.pages[0]?.assets.total ?? 0;

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={state.text ? t('Results for "{text}"', { text: state.text }) : t('Search results')}>
        {assets.length > 0 && <span className="text-sm text-muted">{t('{count} results', { count: total || assets.length })}</span>}
      </PageHeader>
      <div className="min-h-0 flex-1">
        {empty ? (
          <EmptyState icon={mdiMagnify} title={t('Search your photos')} text={t('Type in the search box above, or open the filter button for dates, places, people and more.')} />
        ) : results.isLoading ? (
          <PageSpinner />
        ) : results.isError ? (
          <EmptyState icon={mdiMagnify} title={t('Search is not available')} text={(results.error as Error).message} />
        ) : assets.length === 0 && albums.length === 0 ? (
          <EmptyState icon={mdiMagnify} title={t('No results')} text={t('Try different words or fewer filters.')} />
        ) : (
          <AssetListView
            assets={assets}
            base="/search"
            header={
              albums.length > 0 && (
                <section className="py-3">
                  <h2 className="mb-2 font-semibold">{t('Albums')}</h2>
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
                    {albums.map((a) => (
                      <AlbumCard key={a.id} album={a} mine={a.owner.id === user?.id} />
                    ))}
                  </div>
                </section>
              )
            }
            footer={
              results.hasNextPage && (
                <div className="flex justify-center py-6">
                  <Button variant="outline" loading={results.isFetchingNextPage} onClick={() => results.fetchNextPage()}>
                    {t('Load more')}
                  </Button>
                </div>
              )
            }
          />
        )}
      </div>
      <Link to="/explore" className="sr-only">
        {t('Explore')}
      </Link>
    </div>
  );
}
