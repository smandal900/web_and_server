import { lazy, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { getAsset, thumbnailUrl, updateAssets } from '../../api/assets';
import { Boundary } from '../../components/ui/Boundary';
import { Button } from '../../components/ui/Button';
import { PageBody, PageHeader } from '../../components/ui/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { useRun } from '../../hooks/useRun';
import { t } from '../../i18n';

const LocationPicker = lazy(() => import('../../components/map/LocationPicker'));

/** Place a single picture on the map. */
export default function GeolocationPhoto() {
  const { photoId = '' } = useParams();
  const navigate = useNavigate();
  const run = useRun();
  const asset = useQuery({ queryKey: ['asset', photoId], queryFn: () => getAsset(photoId) });
  const [point, setPoint] = useState<{ lat: number; lon: number }>();

  if (asset.isLoading) return <PageSpinner />;
  const save = async () => {
    if (!point) return;
    const r = await run(() => updateAssets([photoId], { latitude: point.lat, longitude: point.lon }), { success: t('Location saved'), invalidate: [['asset'], ['search']] });
    if (r.ok) navigate('/utilities/geolocation');
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={asset.data?.originalFileName ?? t('Photo')}>
        <Button variant="outline" onClick={() => navigate('/utilities/geolocation')}>
          {t('Back')}
        </Button>
        <Button disabled={!point} onClick={save}>
          {t('Save')}
        </Button>
      </PageHeader>
      <PageBody>
        <div className="grid gap-4 md:grid-cols-2">
          <img src={thumbnailUrl(photoId, 'preview')} alt="" className="max-h-[70vh] w-full rounded-2xl object-contain" />
          <Boundary>
            <LocationPicker lat={point?.lat} lon={point?.lon} onChange={(lat, lon) => setPoint({ lat, lon })} className="h-[70vh] w-full overflow-hidden rounded-2xl" />
          </Boundary>
        </div>
      </PageBody>
    </div>
  );
}
