import { useState } from 'react';
import { changePassword } from '../../../api/core';
import { Button } from '../../../components/ui/Button';
import { Switch, TextField } from '../../../components/ui/Fields';
import { useRun } from '../../../hooks/useRun';
import { t } from '../../../i18n';

export default function Password() {
  const run = useRun();
  const [form, setForm] = useState({ password: '', newPassword: '', confirm: '' });
  const [logoutOthers, setLogoutOthers] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const mismatch = form.confirm !== '' && form.newPassword !== form.confirm;

  const save = async () => {
    const r = await run(() => changePassword({ password: form.password, newPassword: form.newPassword, invalidateSessions: logoutOthers }), { success: t('Password changed') });
    if (r.ok) setForm({ password: '', newPassword: '', confirm: '' });
  };

  return (
    <div className="flex flex-col gap-4">
      <TextField label={t('Current password')} type="password" autoComplete="current-password" value={form.password} onChange={set('password')} />
      <TextField label={t('New password')} type="password" autoComplete="new-password" minLength={8} value={form.newPassword} onChange={set('newPassword')} />
      <TextField label={t('Confirm new password')} type="password" autoComplete="new-password" error={mismatch ? t('Passwords do not match') : undefined} value={form.confirm} onChange={set('confirm')} />
      <Switch label={t('Sign out of my other devices')} checked={logoutOthers} onChange={setLogoutOthers} />
      <div>
        <Button disabled={!form.password || form.newPassword.length < 8 || mismatch || !form.confirm} onClick={save}>
          {t('Change password')}
        </Button>
      </div>
    </div>
  );
}
