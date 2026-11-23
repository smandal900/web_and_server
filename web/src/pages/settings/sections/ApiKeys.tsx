import { useState } from 'react';
import { mdiDeleteOutline, mdiPencilOutline, mdiPlus } from '@mdi/js';
import { useQuery } from '@tanstack/react-query';
import { createApiKey, deleteApiKey, getApiKeys, updateApiKey } from '../../../api/admin';
import type { ApiKey } from '../../../api/types';
import { Button, IconButton } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Checkbox, TextField } from '../../../components/ui/Fields';
import { Modal } from '../../../components/ui/Modal';
import { useRun } from '../../../hooks/useRun';
import { t } from '../../../i18n';
import { formatDate } from '../../../lib/format';
import { PERMISSION_GROUPS } from '../../../lib/permissions';
import { useToast } from '../../../state/ToastProvider';
import { copyText } from '../../../lib/clipboard';

/** Create or edit a key: a name plus either "everything" or a hand-picked set of permissions. */
function KeyModal({ existing, onClose, onSecret }: { existing?: ApiKey; onClose: () => void; onSecret: (secret: string) => void }) {
  const run = useRun();
  const [name, setName] = useState(existing?.name ?? '');
  const [all, setAll] = useState(existing ? existing.permissions.includes('all') : true);
  const [chosen, setChosen] = useState<string[]>(existing?.permissions.filter((p) => p !== 'all') ?? []);
  const flip = (p: string) => setChosen((c) => (c.includes(p) ? c.filter((x) => x !== p) : [...c, p]));
  const permissions = all ? ['all'] : chosen;

  const save = async () => {
    if (existing) {
      const r = await run(() => updateApiKey(existing.id, { name, permissions }), { success: t('Key updated'), invalidate: [['api-keys']] });
      if (r.ok) onClose();
    } else {
      const r = await run(() => createApiKey({ name, permissions }), { invalidate: [['api-keys']] });
      if (r.ok) (onClose(), onSecret(r.data.secret));
    }
  };

  return (
    <Modal title={existing ? t('Edit API key') : t('New API key')} size="lg" onClose={onClose} footer={<><Button variant="outline" onClick={onClose}>{t('Cancel')}</Button><Button disabled={!name.trim() || (!all && chosen.length === 0)} onClick={save}>{t('Save')}</Button></>}>
      <TextField label={t('Name')} value={name} onChange={setName} />
      <div className="mt-4">
        <Checkbox label={t('Full access (all permissions)')} checked={all} onChange={setAll} />
      </div>
      {!all && (
        <div className="mt-3 space-y-3">
          {PERMISSION_GROUPS.map((g) => (
            <fieldset key={g.group}>
              <legend className="mb-1 flex w-full items-center justify-between text-xs font-semibold text-primary uppercase">
                {g.group}
                <button type="button" className="font-normal normal-case" onClick={() => setChosen((c) => (g.items.every((i) => c.includes(i)) ? c.filter((x) => !g.items.includes(x)) : [...new Set([...c, ...g.items])]))}>
                  {t('Toggle all')}
                </button>
              </legend>
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                {g.items.map((p) => (
                  <Checkbox key={p} label={<span className="text-xs">{p}</span>} checked={chosen.includes(p)} onChange={() => flip(p)} />
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      )}
    </Modal>
  );
}

export default function ApiKeys() {
  const run = useRun();
  const toast = useToast();
  const list = useQuery({ queryKey: ['api-keys'], queryFn: getApiKeys, retry: false });
  const [editing, setEditing] = useState<ApiKey | 'new' | null>(null);
  const [secret, setSecret] = useState<string>();
  const [deleting, setDeleting] = useState<ApiKey | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-y divide-line">
        {(list.data ?? []).map((k) => (
          <li key={k.id} className="flex items-center gap-3 py-2">
            <div className="flex-1 text-sm">
              {k.name}
              <span className="block text-xs text-muted">
                {t('Created {date}', { date: formatDate(k.createdAt) })} · {k.permissions.includes('all') ? t('Full access') : t('{count} permissions', { count: k.permissions.length })}
              </span>
            </div>
            <IconButton path={mdiPencilOutline} label={t('Edit')} size={18} onClick={() => setEditing(k)} />
            <IconButton path={mdiDeleteOutline} label={t('Delete')} size={18} onClick={() => setDeleting(k)} />
          </li>
        ))}
        {!list.isLoading && (list.data?.length ?? 0) === 0 && <li className="py-2 text-sm text-muted">{t('No API keys yet.')}</li>}
      </ul>
      <div>
        <Button variant="outline" icon={mdiPlus} onClick={() => setEditing('new')}>
          {t('New API key')}
        </Button>
      </div>
      {editing && <KeyModal existing={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSecret={setSecret} />}
      {secret && (
        <Modal title={t('Your new API key')} size="sm" onClose={() => setSecret(undefined)} footer={<Button onClick={() => setSecret(undefined)}>{t('Done')}</Button>}>
          <p className="mb-2 text-sm text-warning">{t('Copy it now. It is shown only once.')}</p>
          <code className="block rounded-lg bg-panel p-3 text-xs break-all">{secret}</code>
          <Button className="mt-3" variant="outline" size="sm" onClick={() => copyText(secret).then(() => toast.success(t('Copied to clipboard')))}>
            {t('Copy')}
          </Button>
        </Modal>
      )}
      {deleting && <ConfirmDialog title={t('Delete API key?')} message={t('Programs using "{name}" will stop working.', { name: deleting.name })} confirmText="Delete" danger onClose={() => setDeleting(null)} onConfirm={() => run(() => deleteApiKey(deleting.id), { success: t('Key deleted'), invalidate: [['api-keys']] })} />}
    </div>
  );
}
