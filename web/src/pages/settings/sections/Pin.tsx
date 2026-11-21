import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { changePin, getAuthStatus, resetPin, setupPin } from '../../../api/core';
import { Button } from '../../../components/ui/Button';
import { TextField } from '../../../components/ui/Fields';
import { useRun } from '../../../hooks/useRun';
import { t } from '../../../i18n';

const digits = (v: string) => v.replace(/\D/g, '').slice(0, 6);

/** Create, change or remove the PIN that unlocks the locked folder. */
export default function Pin() {
  const run = useRun();
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ['auth-status'], queryFn: getAuthStatus, retry: false });
  const [pin, setPin] = useState('');
  const [next, setNext] = useState('');
  const [password, setPassword] = useState('');
  const has = !!status.data?.pinCode;
  const refresh = () => qc.invalidateQueries({ queryKey: ['auth-status'] });

  return (
    <div className="flex max-w-xs flex-col gap-3">
      <p className="text-sm text-muted">{has ? t('A PIN protects your locked folder.') : t('You have not set a PIN yet.')}</p>
      {has ? (
        <>
          <TextField label={t('Current PIN')} type="password" inputMode="numeric" value={pin} onChange={(v) => setPin(digits(v))} />
          <TextField label={t('New PIN')} type="password" inputMode="numeric" value={next} onChange={(v) => setNext(digits(v))} />
          <Button disabled={pin.length !== 6 || next.length !== 6} onClick={() => run(() => changePin({ pinCode: pin, newPinCode: next }), { success: t('PIN changed') }).then(() => (setPin(''), setNext('')))}>
            {t('Change PIN')}
          </Button>
          <hr className="border-line" />
          <TextField label={t('Password (to remove the PIN)')} type="password" value={password} onChange={setPassword} />
          <Button variant="danger-outline" disabled={!password} onClick={() => run(() => resetPin({ password }), { success: t('PIN removed') }).then(() => (setPassword(''), refresh()))}>
            {t('Remove PIN')}
          </Button>
        </>
      ) : (
        <>
          <TextField label={t('New 6-digit PIN')} type="password" inputMode="numeric" value={next} onChange={(v) => setNext(digits(v))} />
          <Button disabled={next.length !== 6} onClick={() => run(() => setupPin(next), { success: t('PIN created') }).then(() => (setNext(''), refresh()))}>
            {t('Create PIN')}
          </Button>
        </>
      )}
    </div>
  );
}
