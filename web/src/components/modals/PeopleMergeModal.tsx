import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { personThumbnailUrl } from '../../api/assets';
import { getPeople, mergePeople } from '../../api/library';
import type { Person } from '../../api/types';
import { useRun } from '../../hooks/useRun';
import { t } from '../../i18n';
import { cx } from '../../lib/cx';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

/** Merge other people INTO this one (they are the same person that was detected twice). */
export default function PeopleMergeModal({ person, onClose }: { person: Person; onClose: () => void }) {
  const run = useRun();
  const navigate = useNavigate();
  const people = useQuery({ queryKey: ['people', 'merge'], queryFn: () => getPeople({ withHidden: false, size: 500 }), retry: false });
  const [chosen, setChosen] = useState<string[]>([]);
  const candidates = (people.data?.people ?? []).filter((p) => p.id !== person.id);

  const merge = async () => {
    const result = await run(() => mergePeople(person.id, chosen), { success: t('People merged'), invalidate: [['people'], ['person'], ['timeline']] });
    if (result.ok) {
      onClose();
      navigate(`/people/${person.id}`);
    }
  };

  return (
    <Modal
      title={t('Merge into {name}', { name: person.name || t('this person') })}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button disabled={chosen.length === 0} onClick={merge}>
            {t('Merge {count}', { count: chosen.length })}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-muted">{t('Choose the people that are really the same person.')}</p>
      <div className="grid max-h-80 grid-cols-4 gap-3 overflow-y-auto sm:grid-cols-6">
        {candidates.map((p) => {
          const on = chosen.includes(p.id);
          return (
            <button key={p.id} onClick={() => setChosen(on ? chosen.filter((x) => x !== p.id) : [...chosen, p.id])} className={cx('flex flex-col items-center gap-1 rounded-xl p-1', on ? 'bg-primary/20 ring-2 ring-primary' : 'hover:bg-panel')}>
              <img src={personThumbnailUrl(p.id)} alt="" className="size-14 rounded-full bg-panel object-cover" />
              <span className="w-full truncate text-xs">{p.name || t('Unknown')}</span>
            </button>
          );
        })}
        {!people.isLoading && candidates.length === 0 && <p className="col-span-full text-sm text-muted">{t('There are no other people.')}</p>}
      </div>
    </Modal>
  );
}
