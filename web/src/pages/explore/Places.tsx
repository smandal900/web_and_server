import { useState } from 'react';
import { Link } from 'react-router';
import { mdiMapMarkerOutline } from '@mdi/js';
import { useQuery } from '@tanstack/react-query';
import { thumbnailUrl } from '../../api/assets';
import { getCities } from '../../api/library';
import { TextField } from '../../components/ui/Fields';
import { EmptyState } from '../../components/ui/Misc';
import { PageBody, PageHeader } from '../../components/ui/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { t } from '../../i18n';
import { searchUrl } from '../../lib/search';

/** One tile per city, each with a sample picture. Click to see that city's photos. */
export default function Places() {
  const [filter, setFilter] = useState('');
  const cities = useQuery({ queryKey: ['cities'], queryFn: getCities, retry: false });
  const shown = (cities.data ?? []).filter((a) => (a.exifInfo?.city ?? '').toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t('Places')} />
      <PageBody>
        {cities.isLoading && <PageSpinner />}
        {!cities.isLoading && (cities.data?.length ?? 0) === 0 && (
          <EmptyState icon={mdiMapMarkerOutline} title={t('No places yet')} text={t('Photos with a location are grouped by city here.')} />
        )}
        {(cities.data?.length ?? 0) > 0 && (
          <>
            <div className="mb-4 max-w-sm">
              <TextField placeholder={t('Search places')} value={filter} onChange={setFilter} />
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
              {shown.map((a) => (
                <Link key={a.id} to={searchUrl({ city: a.exifInfo?.city ?? '', state: a.exifInfo?.state ?? undefined, country: a.exifInfo?.country ?? undefined })} className="group relative aspect-square overflow-hidden rounded-2xl bg-panel">
                  <img src={thumbnailUrl(a.id)} alt="" loading="lazy" className="size-full object-cover transition group-hover:scale-105" />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-sm font-medium text-white">{a.exifInfo?.city}</span>
                </Link>
              ))}
            </div>
          </>
        )}
      </PageBody>
    </div>
  );
}
