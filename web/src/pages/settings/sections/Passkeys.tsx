import { useState } from 'react';
import { mdiDeleteOutline, mdiFingerprint, mdiPencilOutline } from '@mdi/js';
import { useQuery } from '@tanstack/react-query';
import { deletePasskey, finishPasskeyRegistration, getPasskeys, renamePasskey, startPasskeyRegistration } from '../../../api/admin';
import { Button, IconButton } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { TextField } from '../../../components/ui/Fields';
import { Icon } from '../../../components/ui/Icon';
import { Modal } from '../../../components/ui/Modal';
import { useRun } from '../../../hooks/useRun';
import { t } from '../../../i18n';
import { formatDate } from '../../../lib/format';
import { createPasskey } from '../../../lib/webauthn';
import type { Passkey } from '../../../api/types';

export default function Passkeys() {
  const run = useRun();
  const list = useQuery({ queryKey: ['passkeys'], queryFn: getPasskeys, retry: false });
  const [renaming, setRenaming] = useState<Passkey | null>(null);
  const [name, setName] = useState('');
  const [deleting, setDeleting] = useState<Passkey | null>(null);
  const refresh = [['passkeys']];

  const add = () =>
    run(
      async () => {
        const options = await startPasskeyRegistration();
        const credential = await createPasskey(options);
        return finishPasskeyRegistration({ name: t('My passkey'), credential });
      },
      { success: t('Passkey added'), invalidate: refresh },
    );

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">{t('A passkey lets you sign in with your fingerprint, face or device PIN.')}</p>
      <ul className="divide-y divide-line">
        {(list.data ?? []).map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-2">
            <Icon path={mdiFingerprint} className="text-primary" />
            <div className="flex-1 text-sm">
              {p.name}
              <span className="block text-xs text-muted">{t('Added {date}', { date: formatDate(p.createdAt) })}</span>
            </div>
            <IconButton path={mdiPencilOutline} label={t('Rename')} size={18} onClick={() => (setRenaming(p), setName(p.name))} />
            <IconButton path={mdiDeleteOutline} label={t('Delete')} size={18} onClick={() => setDeleting(p)} />
          </li>
        ))}
        {!list.isLoading && (list.data?.length ?? 0) === 0 && <li className="py-2 text-sm text-muted">{t('No passkeys yet.')}</li>}
      </ul>
      <div>
        <Button variant="outline" icon={mdiFingerprint} onClick={add}>
          {t('Add a passkey')}
        </Button>
      </div>
      {renaming && (
        <Modal title={t('Rename passkey')} size="sm" onClose={() => setRenaming(null)} footer={<><Button variant="outline" onClick={() => setRenaming(null)}>{t('Cancel')}</Button><Button disabled={!name.trim()} onClick={async () => { const r = await run(() => renamePasskey(renaming.id, name.trim()), { invalidate: refresh }); if (r.ok) setRenaming(null); }}>{t('Save')}</Button></>}>
          <TextField label={t('Name')} value={name} onChange={setName} />
        </Modal>
      )}
      {deleting && <ConfirmDialog title={t('Delete passkey?')} message={deleting.name} confirmText="Delete" danger onClose={() => setDeleting(null)} onConfirm={() => run(() => deletePasskey(deleting.id), { success: t('Passkey deleted'), invalidate: refresh })} />}
    </div>
  );
}
