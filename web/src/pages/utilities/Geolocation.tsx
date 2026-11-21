import { mdiMapMarkerCheckOutline } from '@mdi/js';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { searchAssets } from '../../api/library';
import { AssetListView } from '../../components/timeline/AssetListView';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/Misc';
import { PageHeader } from '../../components/ui/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { t } from '../../i18n';

/** Pictures that have no place yet. Select some and use "Change location" to add one. */
export default function Geolocation() {
  const list = useQuery({
    queryKey: ['search', 'no-location'],
    queryFn: async () => {
      const result = await searchAssets({ size: 1000, withArchived: false } as never);
      return result.assets.items.filter((a) => a.exifInfo?.latitude == null || a.exifInfo?.longitude == null);
    },
    retry: false,
  });
  const assets = list.data ?? [];

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t('Manage locations')}>
        {assets[0] && (
          <Link to={`/utilities/geolocation/photos/${assets[0].id}`}>
            <Button variant="outline">{t('One by one')}</Button>
          </Link>
        )}
      </PageHeader>
      <div className="min-h-0 flex-1">
        {list.isLoading ? (
          <PageSpinner />
        ) : list.isError ? (
          <EmptyState icon={mdiMapMarkerCheckOutline} title={t('Not available')} text={(list.error as Error).message} />
        ) : assets.length === 0 ? (
          <EmptyState icon={mdiMapMarkerCheckOutline} title={t('Every photo has a place')} />
        ) : (
          <AssetListView assets={assets} base="/utilities/geolocation" actions={['changeLocation', 'changeDate']} />
        )}
      </div>
    </div>
  );
}
