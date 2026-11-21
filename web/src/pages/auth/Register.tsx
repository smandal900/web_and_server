import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { errorMessage } from '../../api/client';
import { signUpAdmin } from '../../api/core';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Fields';
import { PageSpinner } from '../../components/ui/Spinner';
import { useServerConfig } from '../../hooks/useServer';
import { t } from '../../i18n';
import { useAuth } from '../../state/AuthProvider';

/** First start of a fresh server: create the admin account, then log in with it. */
export default function Register() {
  const config = useServerConfig();
  const { login } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', name: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  if (config.isLoading) return <PageSpinner />;
  if (config.data?.isInitialized) return <Navigate to="/auth/login" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) return setError(t('Passwords do not match'));
    setBusy(true);
    setError('');
    try {
      await signUpAdmin({ email: form.email, name: form.name, password: form.password });
      await qc.invalidateQueries({ queryKey: ['server-config'] });
      await login(form.email, form.password);
      navigate('/auth/onboarding', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <AuthLayout title={t('Welcome! Create the admin account')}>
      <p className="mb-5 text-center text-sm text-muted">{t('The first account becomes the administrator who manages this server.')}</p>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField label={t('Admin email')} type="email" required value={form.email} onChange={set('email')} />
        <TextField label={t('Name')} required value={form.name} onChange={set('name')} />
        <TextField label={t('Password')} type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={set('password')} />
        <TextField label={t('Confirm password')} type="password" required autoComplete="new-password" value={form.confirm} onChange={set('confirm')} />
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" loading={busy}>
          {t('Sign up')}
        </Button>
      </form>
    </AuthLayout>
  );
}
