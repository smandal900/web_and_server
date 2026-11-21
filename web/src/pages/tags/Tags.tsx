import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { mdiDeleteOutline, mdiPalette, mdiPlus, mdiTagOutline } from '@mdi/js';
import { useQuery } from '@tanstack/react-query';
import { createTag, deleteTag, getTags, updateTag } from '../../api/library';
import { TimelinePage } from '../../components/timeline/TimelinePage';
import { Button, IconButton } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { TextField } from '../../components/ui/Fields';
import { EmptyState } from '../../components/ui/Misc';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { Tree } from '../../components/ui/Tree';
import { useRun } from '../../hooks/useRun';
import { t } from '../../i18n';
import { buildTree } from '../../lib/tree';

/** Tags as a tree on the left (use / to nest), and the pictures with the chosen tag on the right. */
export default function Tags() {
  const run = useRun();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const selectedPath = params.get('path') ?? undefined;
  const tags = useQuery({ queryKey: ['tags'], queryFn: getTags });
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#4250af');
  const [colorOpen, setColorOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const list = tags.data ?? [];
  const tree = useMemo(() => buildTree(list.map((x) => x.value)), [list]);
  const selected = list.find((x) => x.value === selectedPath);

  const create = async () => {
    const result = await run(() => createTag({ name: name.trim() }), { success: t('Tag created'), invalidate: [['tags']] });
    if (result.ok) {
      setCreating(false);
      setName('');
      setParams({ path: result.data.value });
    }
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t('Tags')}>
        <Button icon={mdiPlus} onClick={() => setCreating(true)}>
          <span className="max-md:hidden">{t('Create tag')}</span>
        </Button>
      </PageHeader>
      <div className="flex min-h-0 flex-1 max-md:flex-col">
        <aside className="w-72 shrink-0 overflow-y-auto border-r border-line p-3 max-md:max-h-48 max-md:w-full max-md:border-r-0 max-md:border-b">
          {tags.isLoading ? <PageSpinner /> : tree.length === 0 ? <p className="p-3 text-sm text-muted">{t('No tags yet.')}</p> : <Tree nodes={tree} selected={selectedPath} onSelect={(path) => setParams({ path })} icon={mdiTagOutline} />}
        </aside>
        <div className="min-h-0 min-w-0 flex-1">
          {selected ? (
            <TimelinePage
              title={selected.value}
              base="/tags"
              query={{ tagId: selected.id, order: 'desc' }}
              headerActions={
                <>
                  <IconButton path={mdiPalette} label={t('Tag color')} onClick={() => (setColor(selected.color ?? '#4250af'), setColorOpen(true))} />
                  <IconButton path={mdiDeleteOutline} label={t('Delete tag')} onClick={() => setDeleting(true)} />
                </>
              }
              empty={<EmptyState icon={mdiTagOutline} title={t('No photos with this tag')} />}
            />
          ) : (
            <EmptyState icon={mdiTagOutline} title={t('Choose a tag')} text={t('Pick a tag on the left to see its photos.')} />
          )}
        </div>
      </div>

      {creating && (
        <Modal title={t('Create tag')} size="sm" onClose={() => setCreating(false)} footer={<><Button variant="outline" onClick={() => setCreating(false)}>{t('Cancel')}</Button><Button disabled={!name.trim()} onClick={create}>{t('Create')}</Button></>}>
          <TextField label={t('Name')} help={t('Use / to nest, for example Trips/2024')} value={name} onChange={setName} />
        </Modal>
      )}
      {colorOpen && selected && (
        <Modal title={t('Tag color')} size="sm" onClose={() => setColorOpen(false)} footer={<><Button variant="outline" onClick={() => setColorOpen(false)}>{t('Cancel')}</Button><Button onClick={async () => { const r = await run(() => updateTag(selected.id, { color }), { success: t('Color saved'), invalidate: [['tags']] }); if (r.ok) setColorOpen(false); }}>{t('Save')}</Button></>}>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label={t('Tag color')} className="h-12 w-full rounded-lg" />
        </Modal>
      )}
      {deleting && selected && (
        <ConfirmDialog
          title={t('Delete tag?')}
          message={t('The tag "{name}" is removed from all photos. The photos stay.', { name: selected.value })}
          confirmText="Delete"
          danger
          onClose={() => setDeleting(false)}
          onConfirm={() => run(() => deleteTag(selected.id), { success: t('Tag deleted'), invalidate: [['tags']] }).then((r) => r.ok && navigate('/tags'))}
        />
      )}
    </div>
  );
}
