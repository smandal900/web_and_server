import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { bulkTag, createTag, getTags } from '../../api/library';
import { useRun } from '../../hooks/useRun';
import { t } from '../../i18n';
import { Button } from '../ui/Button';
import { Checkbox, TextField } from '../ui/Fields';
import { Modal } from '../ui/Modal';

/** Pick existing tags (or type a new one) and put them on the chosen pictures. */
export default function TagAssetsModal({ assetIds, onClose, onDone }: { assetIds: string[]; onClose: () => void; onDone: () => void }) {
  const run = useRun();
  const tags = useQuery({ queryKey: ['tags'], queryFn: getTags, retry: false });
  const [chosen, setChosen] = useState<string[]>([]);
  const [newName, setNewName] = useState('');

  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const save = async () => {
    const result = await run(
      async () => {
        const tagIds = [...chosen];
        if (newName.trim()) tagIds.push((await createTag({ name: newName.trim() })).id);
        return bulkTag(assetIds, tagIds);
      },
      { success: t('Tags saved'), invalidate: [['tags'], ['asset']] },
    );
    if (result.ok) onDone();
  };

  return (
    <Modal
      title={t('Tag')}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button onClick={save} disabled={chosen.length === 0 && !newName.trim()}>
            {t('Save')}
          </Button>
        </>
      }
    >
      <TextField label={t('New tag')} help={t('Use / to nest tags, for example Trips/2024')} value={newName} onChange={setNewName} />
      <div className="mt-4 flex max-h-60 flex-col gap-2 overflow-y-auto">
        {(tags.data ?? []).map((tag) => (
          <Checkbox key={tag.id} label={tag.value} checked={chosen.includes(tag.id)} onChange={() => toggle(tag.id)} />
        ))}
        {!tags.isLoading && (tags.data ?? []).length === 0 && <p className="text-sm text-muted">{t('No tags yet.')}</p>}
      </div>
    </Modal>
  );
}
