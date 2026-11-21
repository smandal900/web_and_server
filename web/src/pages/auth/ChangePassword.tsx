import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { errorMessage } from '../../api/client';
import { changePassword } from '../../api/core';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Fields';
import { t } from '../../i18n';
import { useAuth } from '../../state/AuthProvider';
import { useToast } from '../../state/ToastProvider';

/** Shown when an admin created the account with "must change password", and from the account menu. */
export default function ChangePassword() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ password: '', newPassword: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) return setError(t('Passwords do not match'));
    setBusy(true);
    setError('');
    try {
      await changePassword({ password: form.password, newPassword: form.newPassword });
      toast.success(t('Password changed'));
      await refresh();
      navigate('/photos', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <AuthLayout title={t('Change password')}>
      <p className="mb-5 text-center text-sm text-muted">
        {t('Hello {name}, this is either your first time signing in or a password change was requested.', { name: user?.name ?? '' })}
      </p>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField label={t('Current password')} type="password" required autoComplete="current-password" value={form.password} onChange={set('password')} />
        <TextField label={t('New password')} type="password" required minLength={8} autoComplete="new-password" value={form.newPassword} onChange={set('newPassword')} />
        <TextField label={t('Confirm new password')} type="password" required autoComplete="new-password" value={form.confirm} onChange={set('confirm')} />
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" loading={busy}>
          {t('Change password')}
        </Button>
      </form>
    </AuthLayout>
  );
}
