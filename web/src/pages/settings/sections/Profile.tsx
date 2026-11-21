import { lazy, useState } from 'react';
import { deleteAvatar, updateMe } from '../../../api/core';
import { Boundary } from '../../../components/ui/Boundary';
import { Button } from '../../../components/ui/Button';
import { TextField } from '../../../components/ui/Fields';
import { Avatar } from '../../../components/ui/Misc';
import { useRun } from '../../../hooks/useRun';
import { t } from '../../../i18n';
import { formatDate } from '../../../lib/format';
import { useAuth } from '../../../state/AuthProvider';

const AvatarModal = lazy(() => import('../../../components/modals/AvatarModal'));

export default function Profile() {
  const { user, refresh } = useAuth();
  const run = useRun();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [cropping, setCropping] = useState(false);
  if (!user) return null;

  const save = async () => {
    const r = await run(() => updateMe({ name, email }), { success: t('Profile saved') });
    if (r.ok) await refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <Avatar user={user} size={72} />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setCropping(true)}>
            {t('Change picture')}
          </Button>
          {user.profileImagePath && (
            <Button variant="ghost" size="sm" onClick={() => run(() => deleteAvatar(), { success: t('Picture removed') }).then(() => refresh())}>
              {t('Remove')}
            </Button>
          )}
        </div>
      </div>
      <TextField label={t('Name')} value={name} onChange={setName} />
      <TextField label={t('Email')} type="email" value={email} onChange={setEmail} />
      <dl className="grid grid-cols-2 gap-2 text-sm text-muted">
        <dt>{t('Member since')}</dt>
        <dd>{formatDate(user.createdAt)}</dd>
        {user.storageLabel && (
          <>
            <dt>{t('Storage label')}</dt>
            <dd>{user.storageLabel}</dd>
          </>
        )}
      </dl>
      <div>
        <Button disabled={name === user.name && email === user.email} onClick={save}>
          {t('Save')}
        </Button>
      </div>
      <Boundary compact fallback={null}>
        {cropping && <AvatarModal onClose={() => setCropping(false)} onSaved={() => (setCropping(false), refresh())} />}
      </Boundary>
    </div>
  );
}
