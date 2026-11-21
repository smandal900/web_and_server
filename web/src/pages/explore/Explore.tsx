import { Link } from 'react-router';
import { mdiCompassOutline } from '@mdi/js';
import { useQuery } from '@tanstack/react-query';
import { personThumbnailUrl, thumbnailUrl } from '../../api/assets';
import { getExplore, getPeople } from '../../api/library';
import { EmptyState } from '../../components/ui/Misc';
import { PageBody, PageHeader } from '../../components/ui/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { usePreferences } from '../../hooks/usePreferences';
import { t } from '../../i18n';
import { searchUrl } from '../../lib/search';

/** Entry points into the library: people, places and "things" the server has recognised. */
export default function Explore() {
  const { preferences } = usePreferences();
  const people = useQuery({ queryKey: ['people', 'explore'], queryFn: () => getPeople({ size: 12, withHidden: false }), retry: false, enabled: preferences.people.enabled });
  const explore = useQuery({ queryKey: ['explore'], queryFn: getExplore, retry: false });
  const groups = explore.data ?? [];
  const places = groups.find((g) => g.fieldName === 'exifInfo.city')?.items ?? [];
  const things = groups.find((g) => g.fieldName === 'smartInfo.tags')?.items ?? [];
  const peopleList = people.data?.people.filter((p) => p.name).slice(0, 12) ?? [];
  const nothing = peopleList.length === 0 && places.length === 0 && things.length === 0;

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t('Explore')} />
      <PageBody>
        {explore.isLoading && <PageSpinner />}
        {!explore.isLoading && nothing && (
          <EmptyState icon={mdiCompassOutline} title={t('Nothing to explore yet')} text={t('As your photos get places, people and tags, they show up here.')} />
        )}

        {peopleList.length > 0 && (
          <section className="mb-8">
            <div className="mb-3 flex justify-between">
              <h2 className="font-semibold">{t('People')}</h2>
              <Link to="/people" className="text-sm text-primary">
                {t('View all')}
              </Link>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {peopleList.map((p) => (
                <Link key={p.id} to={`/people/${p.id}`} className="flex w-24 shrink-0 flex-col items-center gap-1 text-center">
                  <img src={personThumbnailUrl(p.id)} alt="" className="size-24 rounded-full bg-panel object-cover" />
                  <span className="w-full truncate text-sm">{p.name}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {places.length > 0 && (
          <section className="mb-8">
            <div className="mb-3 flex justify-between">
              <h2 className="font-semibold">{t('Places')}</h2>
              <Link to="/places" className="text-sm text-primary">
                {t('View all')}
              </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {places.map((place) => (
                <Link key={place.value} to={searchUrl({ city: place.value })} className="group relative size-40 shrink-0 overflow-hidden rounded-2xl bg-panel">
                  <img src={thumbnailUrl(place.data.id)} alt="" loading="lazy" className="size-full object-cover transition group-hover:scale-105" />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-sm font-medium text-white">{place.value}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {things.length > 0 && (
          <section>
            <h2 className="mb-3 font-semibold">{t('Things')}</h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {things.map((thing) => (
                <Link key={thing.value} to={searchUrl({ text: thing.value, mode: 'smart' })} className="group relative size-40 shrink-0 overflow-hidden rounded-2xl bg-panel">
                  <img src={thumbnailUrl(thing.data.id)} alt="" loading="lazy" className="size-full object-cover transition group-hover:scale-105" />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-sm font-medium text-white">{thing.value}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </PageBody>
    </div>
  );
}
