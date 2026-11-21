import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { mdiEyeOffOutline } from '@mdi/js';
import { useQuery } from '@tanstack/react-query';
import { personThumbnailUrl } from '../../api/assets';
import { getPeople, updatePeople } from '../../api/library';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/Misc';
import { PageBody, PageHeader } from '../../components/ui/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { useRun } from '../../hooks/useRun';
import { t } from '../../i18n';
import { cx } from '../../lib/cx';

/** Click a face to hide it (or bring it back), then save all changes at once. */
export default function PeopleManage() {
  const run = useRun();
  const navigate = useNavigate();
  const people = useQuery({ queryKey: ['people', 'manage'], queryFn: () => getPeople({ withHidden: true, size: 1000 }) });
  const [hidden, setHidden] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (people.data) setHidden(Object.fromEntries(people.data.people.map((p) => [p.id, p.isHidden])));
  }, [people.data]);

  const changed = (people.data?.people ?? []).filter((p) => hidden[p.id] !== p.isHidden);
  const save = async () => {
    const result = await run(() => updatePeople(changed.map((p) => ({ id: p.id, isHidden: hidden[p.id] }))), { success: t('People updated'), invalidate: [['people']] });
    if (result.ok) navigate('/people');
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t('Show & hide people')}>
        <Button variant="outline" onClick={() => navigate('/people')}>
          {t('Cancel')}
        </Button>
        <Button disabled={changed.length === 0} onClick={save}>
          {t('Save')}
        </Button>
      </PageHeader>
      <PageBody>
        {people.isLoading && <PageSpinner />}
        {!people.isLoading && (people.data?.people.length ?? 0) === 0 && <EmptyState icon={mdiEyeOffOutline} title={t('No people to manage')} />}
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10">
          {people.data?.people.map((p) => (
            <button key={p.id} onClick={() => setHidden((h) => ({ ...h, [p.id]: !h[p.id] }))} className="flex flex-col items-center gap-1 text-center">
              <img src={personThumbnailUrl(p.id)} alt="" className={cx('aspect-square w-full rounded-full bg-panel object-cover transition', hidden[p.id] && 'opacity-30 grayscale')} />
              <span className="w-full truncate text-sm">{p.name || t('Unknown')}</span>
            </button>
          ))}
        </div>
      </PageBody>
    </div>
  );
}
