import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { mdiImageAlbum, mdiPlus, mdiViewGridOutline, mdiViewListOutline } from '@mdi/js';
import { useQuery } from '@tanstack/react-query';
import { createAlbum, getAlbums } from '../../api/library';
import { AlbumCard, AlbumCover, albumDateRange } from '../../components/albums/AlbumCard';
import { Button, IconButton } from '../../components/ui/Button';
import { Select } from '../../components/ui/Fields';
import { EmptyState } from '../../components/ui/Misc';
import { PageBody, PageHeader } from '../../components/ui/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { Row, Table } from '../../components/ui/Table';
import { useRun } from '../../hooks/useRun';
import { t } from '../../i18n';
import { formatDate } from '../../lib/format';
import { useAuth } from '../../state/AuthProvider';

type Sort = 'updated' | 'created' | 'name' | 'count';
type Filter = 'all' | 'owned' | 'shared';
const readView = () => (localStorage.getItem('albums-view') === 'table' ? 'table' : 'cards');

export default function Albums() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const run = useRun();
  const albums = useQuery({ queryKey: ['albums'], queryFn: () => getAlbums() });
  const [view, setViewState] = useState<'cards' | 'table'>(readView);
  const [sort, setSort] = useState<Sort>('updated');
  const [filter, setFilter] = useState<Filter>('all');
  const [group, setGroup] = useState<'none' | 'year'>('none');

  const setView = (v: 'cards' | 'table') => {
    setViewState(v);
    try {
      localStorage.setItem('albums-view', v);
    } catch {
      /* ignore */
    }
  };

  const shown = useMemo(() => {
    const list = (albums.data ?? []).filter((a) => (filter === 'owned' ? a.owner.id === user?.id : filter === 'shared' ? a.shared || a.owner.id !== user?.id : true));
    const by: Record<Sort, (a: typeof list[number], b: typeof list[number]) => number> = {
      updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
      created: (a, b) => b.createdAt.localeCompare(a.createdAt),
      name: (a, b) => a.albumName.localeCompare(b.albumName),
      count: (a, b) => b.assetCount - a.assetCount,
    };
    return [...list].sort(by[sort]);
  }, [albums.data, filter, sort, user?.id]);

  const groups = useMemo(() => {
    if (group === 'none') return [{ title: '', items: shown }];
    const map = new Map<string, typeof shown>();
    for (const a of shown) {
      const year = (a.startDate ?? a.createdAt).slice(0, 4);
      map.set(year, [...(map.get(year) ?? []), a]);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([title, items]) => ({ title, items }));
  }, [shown, group]);

  const create = async () => {
    const result = await run(() => createAlbum({ albumName: t('Untitled album') }), { invalidate: [['albums']] });
    if (result.ok) navigate(`/albums/${result.data.id}`);
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t('Albums')}>
        <Button icon={mdiPlus} onClick={create}>
          <span className="max-md:hidden">{t('Create album')}</span>
        </Button>
        <IconButton path={view === 'cards' ? mdiViewListOutline : mdiViewGridOutline} label={view === 'cards' ? t('Table view') : t('Card view')} onClick={() => setView(view === 'cards' ? 'table' : 'cards')} />
      </PageHeader>
      <PageBody>
        <div className="mb-4 grid max-w-2xl grid-cols-3 gap-3 max-md:grid-cols-1">
          <Select label={t('Show')} value={filter} onChange={(v) => setFilter(v as Filter)} options={[{ value: 'all', label: t('All') }, { value: 'owned', label: t('My albums') }, { value: 'shared', label: t('Shared') }]} />
          <Select label={t('Sort by')} value={sort} onChange={(v) => setSort(v as Sort)} options={[{ value: 'updated', label: t('Last modified') }, { value: 'created', label: t('Date created') }, { value: 'name', label: t('Name') }, { value: 'count', label: t('Number of items') }]} />
          <Select label={t('Group by')} value={group} onChange={(v) => setGroup(v as 'none' | 'year')} options={[{ value: 'none', label: t('None') }, { value: 'year', label: t('Year') }]} />
        </div>

        {albums.isLoading && <PageSpinner />}
        {!albums.isLoading && shown.length === 0 && (
          <EmptyState icon={mdiImageAlbum} title={t('No albums yet')} text={t('Albums group photos and videos so you can share them.')}>
            <Button icon={mdiPlus} onClick={create}>
              {t('Create album')}
            </Button>
          </EmptyState>
        )}

        {groups.map((g) => (
          <section key={g.title} className="mb-6">
            {g.title && <h2 className="mb-2 text-lg font-semibold">{g.title}</h2>}
            {view === 'cards' ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
                {g.items.map((a) => (
                  <AlbumCard key={a.id} album={a} mine={a.owner.id === user?.id} />
                ))}
              </div>
            ) : (
              <Table head={['', t('Name'), t('Items'), t('Owner'), t('Dates'), t('Updated')]}>
                {g.items.map((a) => (
                  <Row
                    key={a.id}
                    onClick={() => navigate(`/albums/${a.id}`)}
                    cells={[
                      <AlbumCover key="c" album={a} className="size-12 rounded-lg" />,
                      <Link key="n" to={`/albums/${a.id}`} className="font-medium hover:underline">{a.albumName}</Link>,
                      a.assetCount,
                      a.owner.id === user?.id ? t('You') : a.owner.name,
                      albumDateRange(a),
                      formatDate(a.updatedAt),
                    ]}
                  />
                ))}
              </Table>
            )}
          </section>
        ))}
      </PageBody>
    </div>
  );
}
