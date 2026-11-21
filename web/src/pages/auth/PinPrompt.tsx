import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { mdiLockOutline } from '@mdi/js';
import { errorMessage } from '../../api/client';
import { getAuthStatus, setupPin, unlockSession } from '../../api/core';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Fields';
import { Icon } from '../../components/ui/Icon';
import { t } from '../../i18n';

/** Ask for the PIN that unlocks the locked folder. With no PIN yet, the same screen creates one. */
export default function PinPrompt() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ['auth-status'], queryFn: getAuthStatus, retry: false });
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const hasPin = status.data?.pinCode;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (!hasPin) await setupPin(pin);
      await unlockSession(pin);
      await qc.invalidateQueries({ queryKey: ['auth-status'] });
      const to = params.get('continue');
      navigate(to?.startsWith('/') ? to : '/locked', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setPin('');
    }
  };

  return (
    <AuthLayout title={hasPin ? t('Enter your PIN') : t('Create a PIN')}>
      <form onSubmit={submit} className="flex flex-col items-center gap-4">
        <Icon path={mdiLockOutline} size={48} className="text-primary" />
        <p className="text-center text-sm text-muted">
          {hasPin ? t('The locked folder keeps private photos hidden from the rest of the app.') : t('Choose a 6-digit PIN to protect your locked folder.')}
        </p>
        <div className="w-48">
          <TextField label={t('PIN')} type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={pin} onChange={setPin} autoFocus />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit">{hasPin ? t('Unlock') : t('Create PIN')}</Button>
        <Button variant="ghost" onClick={() => navigate('/photos')}>
          {t('Cancel')}
        </Button>
      </form>
    </AuthLayout>
  );
}
