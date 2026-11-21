import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { createAdminUser, getAdminUser, updateAdminUser } from '../../api/admin';
import { Button } from '../../components/ui/Button';
import { NumberField, Switch, TextField } from '../../components/ui/Fields';
import { PageBody, PageHeader } from '../../components/ui/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { useRun } from '../../hooks/useRun';
import { t } from '../../i18n';

const GIB = 1024 ** 3;
const EMPTY = { name: '', email: '', password: '', isAdmin: false, shouldChangePassword: true, quotaGiB: undefined as number | undefined, storageLabel: '' };

/** Create a user (/admin/users/new) or edit one (/admin/users/:id/edit). */
export default function UserForm() {
  const { id } = useParams();
  const editing = !!id;
  const navigate = useNavigate();
  const run = useRun();
  const existing = useQuery({ queryKey: ['admin-user', id], queryFn: () => getAdminUser(id!), enabled: editing });
  const [form, setForm] = useState(EMPTY);
  const set = <K extends keyof typeof EMPTY>(k: K) => (v: (typeof EMPTY)[K]) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    const u = existing.data;
    if (u) setForm({ name: u.name, email: u.email, password: '', isAdmin: u.isAdmin, shouldChangePassword: u.shouldChangePassword, quotaGiB: u.quotaSizeInBytes ? u.quotaSizeInBytes / GIB : undefined, storageLabel: u.storageLabel ?? '' });
  }, [existing.data]);

  if (editing && existing.isLoading) return <PageSpinner />;

  const save = async () => {
    const body = {
      name: form.name,
      email: form.email,
      isAdmin: form.isAdmin,
      shouldChangePassword: form.shouldChangePassword,
      quotaSizeInBytes: form.quotaGiB ? Math.round(form.quotaGiB * GIB) : null,
      storageLabel: form.storageLabel || null,
      ...(form.password ? { password: form.password } : {}),
    };
    const result = await run(() => (editing ? updateAdminUser(id!, body) : createAdminUser(body)), { success: editing ? t('User saved') : t('User created'), invalidate: [['admin-users'], ['admin-user', id]] });
    if (result.ok) navigate('/admin/users');
  };
  const valid = form.name.trim() && form.email.trim() && (editing || form.password.length >= 8);

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={editing ? t('Edit user') : t('Create user')}>
        <Button variant="outline" onClick={() => navigate('/admin/users')}>
          {t('Cancel')}
        </Button>
        <Button disabled={!valid} onClick={save}>
          {t('Save')}
        </Button>
      </PageHeader>
      <PageBody narrow>
        <div className="flex flex-col gap-4">
          <TextField label={t('Email')} type="email" value={form.email} onChange={set('email')} />
          <TextField label={editing ? t('New password') : t('Password')} help={editing ? t('Leave empty to keep the current password') : t('At least 8 characters')} type="password" autoComplete="new-password" value={form.password} onChange={set('password')} />
          <TextField label={t('Name')} value={form.name} onChange={set('name')} />
          <NumberField label={t('Quota (GiB)')} help={t('Empty means unlimited')} min={0} step={0.5} value={form.quotaGiB} onChange={set('quotaGiB')} />
          <TextField label={t('Storage label')} help={t('A folder name for this user when a storage template uses {{label}}')} value={form.storageLabel} onChange={set('storageLabel')} />
          <Switch label={t('Administrator')} checked={form.isAdmin} onChange={set('isAdmin')} />
          <Switch label={t('Require password change at next login')} checked={form.shouldChangePassword} onChange={set('shouldChangePassword')} />
        </div>
      </PageBody>
    </div>
  );
}
