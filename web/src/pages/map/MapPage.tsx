import { lazy, useMemo, useState } from 'react';
import { mdiMapOutline, mdiTuneVariant } from '@mdi/js';
import { useQuery } from '@tanstack/react-query';
import { getMapMarkers } from '../../api/library';
import { useMapStyle } from '../../components/map/useMapStyle';
import { Boundary } from '../../components/ui/Boundary';
import { IconButton, Button } from '../../components/ui/Button';
import { DateField, Select, Switch } from '../../components/ui/Fields';
import { EmptyState } from '../../components/ui/Misc';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { useAssetRoute } from '../../hooks/useAssetRoute';
import { useFeatures } from '../../hooks/useServer';
import { t } from '../../i18n';

const MapView = lazy(() => import('../../components/map/MapView'));
const AssetViewer = lazy(() => import('../../components/viewer/AssetViewer'));

interface MapFilters {
  isFavorite: boolean;
  withArchived: boolean;
  withPartners: boolean;
  from: string;
  to: string;
  days: string; // "0" = any time
}
const DEFAULT: MapFilters = { isFavorite: false, withArchived: false, withPartners: false, from: '', to: '', days: '0' };
const stored = (): MapFilters => {
  try {
    return { ...DEFAULT, ...JSON.parse(localStorage.getItem('map-filters') ?? '{}') };
  } catch {
    return DEFAULT;
  }
};

/** All geotagged photos on a world map. Settings (favorites only, date range...) are kept in this browser. */
export default function MapPage() {
  const features = useFeatures().data;
  const hasStyle = !!useMapStyle();
  const [filters, setFilters] = useState(stored);
  const [open, setOpen] = useState(false);
  const route = useAssetRoute('/map');

  const query = useMemo(() => {
    const q: Record<string, unknown> = { isFavorite: filters.isFavorite || undefined, withArchived: filters.withArchived || undefined, withPartners: filters.withPartners || undefined };
    if (filters.days !== '0') q.fileCreatedAfter = new Date(Date.now() - Number(filters.days) * 86_400_000).toISOString();
    else if (filters.from) q.fileCreatedAfter = new Date(filters.from).toISOString();
    if (filters.to) q.fileCreatedBefore = new Date(`${filters.to}T23:59:59`).toISOString();
    return q;
  }, [filters]);

  const markers = useQuery({ queryKey: ['map', query], queryFn: () => getMapMarkers(query), retry: false, enabled: features?.map !== false });
  const ids = useMemo(() => (markers.data ?? []).map((m) => m.id), [markers.data]);

  const apply = (next: MapFilters) => {
    setFilters(next);
    try {
      localStorage.setItem('map-filters', JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const disabled = features?.map === false || !hasStyle;
  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t('Map')}>
        <IconButton path={mdiTuneVariant} label={t('Map settings')} onClick={() => setOpen(true)} />
      </PageHeader>
      <div className="relative min-h-0 flex-1">
        {disabled ? (
          <EmptyState icon={mdiMapOutline} title={t('The map is turned off')} text={t('Place names are still shown on the Places page and in the details of each photo.')} />
        ) : (
          <>
            <Boundary>
              <MapView markers={markers.data ?? []} onOpenAsset={route.open} />
            </Boundary>
            {markers.isError && <p className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-bg px-4 py-1 text-sm shadow">{(markers.error as Error).message}</p>}
          </>
        )}
        {route.assetId && (
          <Boundary>
            <AssetViewer assetId={route.assetId} assetIds={ids} onShow={route.show} onClose={route.close} actions={['download']} readOnly />
          </Boundary>
        )}
      </div>
      {open && (
        <Modal
          title={t('Map settings')}
          size="sm"
          onClose={() => setOpen(false)}
          footer={
            <>
              <Button variant="outline" onClick={() => apply(DEFAULT)}>
                {t('Reset')}
              </Button>
              <Button onClick={() => setOpen(false)}>{t('Done')}</Button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <Switch label={t('Favorites only')} checked={filters.isFavorite} onChange={(isFavorite) => apply({ ...filters, isFavorite })} />
            <Switch label={t('Include archived')} checked={filters.withArchived} onChange={(withArchived) => apply({ ...filters, withArchived })} />
            <Switch label={t('Include shared photos')} checked={filters.withPartners} onChange={(withPartners) => apply({ ...filters, withPartners })} />
            <Select
              label={t('Time range')}
              value={filters.days}
              onChange={(days) => apply({ ...filters, days })}
              options={[
                { value: '0', label: t('Any time') },
                { value: '1', label: t('Last 24 hours') },
                { value: '7', label: t('Last 7 days') },
                { value: '30', label: t('Last 30 days') },
                { value: '365', label: t('Last year') },
              ]}
            />
            {filters.days === '0' && (
              <div className="grid grid-cols-2 gap-3">
                <DateField label={t('From')} value={filters.from} onChange={(from) => apply({ ...filters, from })} />
                <DateField label={t('To')} value={filters.to} onChange={(to) => apply({ ...filters, to })} />
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
