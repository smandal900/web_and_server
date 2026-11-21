import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { mdiAccountOutline, mdiDeleteOutline, mdiDotsVertical, mdiPencilOutline, mdiPlus, mdiRestore } from '@mdi/js';
import { useQuery } from '@tanstack/react-query';
import { deleteAdminUser, getAdminUsers, restoreAdminUser } from '../../api/admin';
import type { User } from '../../api/types';
import { Button, IconButton } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Checkbox } from '../../components/ui/Fields';
import { Menu } from '../../components/ui/Menu';
import { Avatar, EmptyState } from '../../components/ui/Misc';
import { PageBody, PageHeader } from '../../components/ui/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { Row, Table } from '../../components/ui/Table';
import { useRun } from '../../hooks/useRun';
import { useServerConfig } from '../../hooks/useServer';
import { t } from '../../i18n';
import { formatBytes, formatDate } from '../../lib/format';
import { useAuth } from '../../state/AuthProvider';

/** Every account on the server. Deleting is soft first (restorable); "delete now" removes it for good. */
export default function Users() {
  const run = useRun();
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const delay = useServerConfig().data?.userDeleteDelay ?? 7;
  const users = useQuery({ queryKey: ['admin-users'], queryFn: () => getAdminUsers(true) });
  const [showDeleted, setShowDeleted] = useState(true);
  const [target, setTarget] = useState<{ user: User; force: boolean } | null>(null);
  const refresh = [['admin-users']];
  const list = (users.data ?? []).filter((u) => showDeleted || !u.deletedAt);

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t('Users')}>
        <Link to="/admin/users/new">
          <Button icon={mdiPlus}>{t('Create user')}</Button>
        </Link>
      </PageHeader>
      <PageBody>
        <div className="mb-3">
          <Checkbox label={t('Show removed users')} checked={showDeleted} onChange={setShowDeleted} />
        </div>
        {users.isLoading && <PageSpinner />}
        {!users.isLoading && list.length === 0 && <EmptyState icon={mdiAccountOutline} title={t('No users')} />}
        {list.length > 0 && (
          <Table head={['', t('Name'), t('Email'), t('Role'), t('Storage'), t('Status'), '']}>
            {list.map((u) => {
              const deleted = !!u.deletedAt;
              return (
                <Row
                  key={u.id}
                  className={deleted ? 'opacity-60' : ''}
                  cells={[
                    <Avatar key="a" user={u} size={36} />,
                    <Link key="n" to={`/admin/users/${u.id}`} className="font-medium hover:underline">{u.name}</Link>,
                    u.email,
                    u.isAdmin ? t('Admin') : t('User'),
                    u.quotaSizeInBytes ? `${formatBytes(u.quotaUsageInBytes)} / ${formatBytes(u.quotaSizeInBytes)}` : formatBytes(u.quotaUsageInBytes),
                    deleted ? t('Removed {date}', { date: formatDate(u.deletedAt) }) : t('Active'),
                    <Menu
                      key="m"
                      trigger={({ toggle }) => <IconButton path={mdiDotsVertical} label={t('Actions')} onClick={toggle} />}
                      items={[
                        { label: t('Edit'), icon: mdiPencilOutline, onClick: () => navigate(`/admin/users/${u.id}/edit`), hidden: deleted },
                        { label: t('Restore'), icon: mdiRestore, onClick: () => run(() => restoreAdminUser(u.id), { success: t('User restored'), invalidate: refresh }), hidden: !deleted },
                        { label: t('Remove'), icon: mdiDeleteOutline, danger: true, onClick: () => setTarget({ user: u, force: false }), hidden: deleted || u.id === me?.id },
                        { label: t('Delete now'), icon: mdiDeleteOutline, danger: true, onClick: () => setTarget({ user: u, force: true }), hidden: !deleted },
                      ]}
                    />,
                  ]}
                />
              );
            })}
          </Table>
        )}
      </PageBody>
      {target && (
        <ConfirmDialog
          title={target.force ? t('Delete {name} permanently?', { name: target.user.name }) : t('Remove {name}?', { name: target.user.name })}
          message={target.force ? t('The account and all of its photos are deleted now. This cannot be undone.') : t('The account is disabled and its photos are deleted after {days} days. You can restore it until then.', { days: delay })}
          confirmText={target.force ? 'Delete now' : 'Remove'}
          danger
          onClose={() => setTarget(null)}
          onConfirm={() => run(() => deleteAdminUser(target.user.id, target.force), { success: t('Done'), invalidate: refresh })}
        />
      )}
    </div>
  );
}
