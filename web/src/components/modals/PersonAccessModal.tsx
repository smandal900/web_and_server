// Sharing people with other members of the same cluster group (a feature of this server).
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { personThumbnailUrl } from '../../api/assets';
import { getGroupUsers } from '../../api/core';
import { setPersonAccess } from '../../api/library';
import type { Person } from '../../api/types';
import { useRun } from '../../hooks/useRun';
import { t } from '../../i18n';
import { useAuth } from '../../state/AuthProvider';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Fields';
import { Modal } from '../ui/Modal';

/** Choose some people and some users: the chosen users may then see the chosen people. */
export default function PersonAccessModal({ people, onClose }: { people: Person[]; onClose: () => void }) {
  const { user } = useAuth();
  const run = useRun();
  const group = useQuery({ queryKey: ['group-users', user?.clusterGroupId], queryFn: () => getGroupUsers(user!.clusterGroupId!), enabled: !!user?.clusterGroupId });
  const others = (group.data ?? []).filter((u) => u.id !== user?.id);
  const [chosenPeople, setChosenPeople] = useState<string[]>([]);
  const [chosenUsers, setChosenUsers] = useState<string[]>([]);
  const flip = (list: string[], set: (l: string[]) => void, id: string) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const save = async () => {
    const result = await run(() => Promise.all(chosenPeople.map((id) => setPersonAccess(id, chosenUsers))), { success: t('Sharing updated'), invalidate: [['people']] });
    if (result.ok) onClose();
  };

  return (
    <Modal
      title={t('Share people')}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button disabled={chosenPeople.length === 0} onClick={save}>
            {t('Save')}
          </Button>
        </>
      }
    >
      <h3 className="mb-2 text-sm font-semibold text-primary">{t('Who can see them')}</h3>
      <div className="mb-4 flex flex-wrap gap-4">
        {others.map((u) => (
          <Checkbox key={u.id} label={u.name} checked={chosenUsers.includes(u.id)} onChange={() => flip(chosenUsers, setChosenUsers, u.id)} />
        ))}
        {!group.isLoading && others.length === 0 && <p className="text-sm text-muted">{t('There is nobody else in your group yet.')}</p>}
      </div>
      <h3 className="mb-2 text-sm font-semibold text-primary">{t('People to share')}</h3>
      <div className="grid max-h-72 grid-cols-4 gap-3 overflow-y-auto sm:grid-cols-6">
        {people.map((p) => {
          const on = chosenPeople.includes(p.id);
          return (
            <button key={p.id} onClick={() => flip(chosenPeople, setChosenPeople, p.id)} className={`flex flex-col items-center gap-1 rounded-xl p-1 ${on ? 'bg-primary/20 ring-2 ring-primary' : 'hover:bg-panel'}`}>
              <img src={personThumbnailUrl(p.id)} alt="" className="size-14 rounded-full bg-panel object-cover" />
              <span className="w-full truncate text-xs">{p.name || t('Unknown')}</span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
