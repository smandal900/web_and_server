import { useState } from 'react';
import { mdiAccountPlusOutline, mdiClose } from '@mdi/js';
import { useQuery } from '@tanstack/react-query';
import { addAlbumUsers, removeAlbumUser, updateAlbum, updateAlbumUser } from '../../api/library';
import { getGroupUsers } from '../../api/core';
import type { Album } from '../../api/types';
import { useRun } from '../../hooks/useRun';
import { t } from '../../i18n';
import { useAuth } from '../../state/AuthProvider';
import { Button, IconButton } from '../ui/Button';
import { Select, Switch } from '../ui/Fields';
import { Avatar } from '../ui/Misc';
import { Modal } from '../ui/Modal';


/** Album settings: order, activity switch, and who the album is shared with (and their role). */
export default function AlbumOptionsModal({ album, onClose }: { album: Album; onClose: () => void }) {
  const { user } = useAuth();
  const run = useRun();
  const isOwner = album.owner.id === user?.id;
  const refresh = [['album', album.id], ['albums']];

  // People that can be added: members of my cluster group who are not in the album yet.
  const group = useQuery({ queryKey: ['group-users', user?.clusterGroupId], queryFn: () => getGroupUsers(user!.clusterGroupId!), enabled: !!user?.clusterGroupId && isOwner, retry: false });
  const candidates = (group.data ?? []).filter((u) => u.id !== album.owner.id && !album.albumUsers.some((m) => m.user.id === u.id));
  const [picked, setPicked] = useState('');
  const [role, setRole] = useState<'viewer' | 'editor'>('viewer');

  return (
    <Modal title={t('Album options')} onClose={onClose} footer={<Button onClick={onClose}>{t('Done')}</Button>}>
      {isOwner && (
        <div className="mb-4 flex flex-col gap-3">
          <Select
            label={t('Order')}
            value={album.order ?? 'desc'}
            onChange={(order) => run(() => updateAlbum(album.id, { order: order as 'asc' | 'desc' }), { invalidate: refresh })}
            options={[
              { value: 'desc', label: t('Newest first') },
              { value: 'asc', label: t('Oldest first') },
            ]}
          />
          <Switch label={t('Comments and likes')} help={t('Let people in a shared album comment and like pictures')} checked={album.isActivityEnabled} onChange={(isActivityEnabled) => run(() => updateAlbum(album.id, { isActivityEnabled }), { invalidate: refresh })} />
        </div>
      )}

      <h3 className="mb-2 text-sm font-semibold text-primary">{t('Members')}</h3>
      <ul className="mb-4 divide-y divide-line">
        <li className="flex items-center gap-3 py-2">
          <Avatar user={album.owner} size={36} />
          <span className="flex-1 text-sm">
            {album.owner.name} <span className="text-muted">({t('Owner')})</span>
          </span>
        </li>
        {album.albumUsers.map((m) => (
          <li key={m.user.id} className="flex items-center gap-3 py-2">
            <Avatar user={m.user} size={36} />
            <span className="flex-1 text-sm">{m.user.name}</span>
            {isOwner ? (
              <>
                <select
                  aria-label={t('Role')}
                  value={m.role}
                  onChange={(e) => run(() => updateAlbumUser(album.id, m.user.id, e.target.value), { invalidate: refresh })}
                  className="rounded-lg bg-panel px-2 py-1 text-sm"
                >
                  <option value="viewer">{t('Viewer')}</option>
                  <option value="editor">{t('Editor')}</option>
                </select>
                <IconButton path={mdiClose} label={t('Remove')} size={18} onClick={() => run(() => removeAlbumUser(album.id, m.user.id), { invalidate: refresh })} />
              </>
            ) : (
              <span className="text-xs text-muted">{m.role === 'editor' ? t('Editor') : t('Viewer')}</span>
            )}
          </li>
        ))}
      </ul>

      {isOwner && (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Select label={t('Share with')} value={picked} onChange={setPicked} options={[{ value: '', label: t('Choose a person') }, ...candidates.map((u) => ({ value: u.id, label: u.name }))]} />
          </div>
          <Select value={role} onChange={(v) => setRole(v as 'viewer' | 'editor')} options={[{ value: 'viewer', label: t('Viewer') }, { value: 'editor', label: t('Editor') }]} />
          <Button
            icon={mdiAccountPlusOutline}
            disabled={!picked}
            onClick={async () => {
              const result = await run(() => addAlbumUsers(album.id, [{ userId: picked, role }]), { success: t('Person added'), invalidate: refresh });
              if (result.ok) setPicked('');
            }}
          >
            {t('Add')}
          </Button>
        </div>
      )}
    </Modal>
  );
}
