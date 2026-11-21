import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { mdiFolderOutline } from '@mdi/js';
import { useQuery } from '@tanstack/react-query';
import { getFolderAssets, getFolderPaths } from '../../api/library';
import { AssetListView } from '../../components/timeline/AssetListView';
import { EmptyState } from '../../components/ui/Misc';
import { PageHeader } from '../../components/ui/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { Tree } from '../../components/ui/Tree';
import { t } from '../../i18n';
import { buildTree } from '../../lib/tree';

/** Browse the library the way it is stored on disk: folders on the left, pictures of the chosen folder on the right. */
export default function Folders() {
  const [params, setParams] = useSearchParams();
  const path = params.get('path') ?? undefined;
  const paths = useQuery({ queryKey: ['folders'], queryFn: getFolderPaths });
  const tree = useMemo(() => buildTree(paths.data ?? []), [paths.data]);
  const assets = useQuery({ queryKey: ['folder-assets', path], queryFn: () => getFolderAssets(path!), enabled: !!path });

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={path ? path.split('/').pop()! : t('Folders')} />
      <div className="flex min-h-0 flex-1 max-md:flex-col">
        <aside className="w-72 shrink-0 overflow-y-auto border-r border-line p-3 max-md:max-h-48 max-md:w-full max-md:border-r-0 max-md:border-b">
          {paths.isLoading ? <PageSpinner /> : tree.length === 0 ? <p className="p-3 text-sm text-muted">{t('No folders yet.')}</p> : <Tree nodes={tree} selected={path} onSelect={(p) => setParams({ path: p })} />}
        </aside>
        <div className="min-h-0 min-w-0 flex-1">
          {!path ? (
            <EmptyState icon={mdiFolderOutline} title={t('Choose a folder')} />
          ) : assets.isLoading ? (
            <PageSpinner />
          ) : (assets.data?.length ?? 0) === 0 ? (
            <EmptyState icon={mdiFolderOutline} title={t('No photos in this folder')} />
          ) : (
            <AssetListView assets={assets.data!} base="/folders" />
          )}
        </div>
      </div>
    </div>
  );
}
