// The public /maintenance page: shown while the server is in maintenance mode, and offers the restore flow
// (1. check what is installed, 2. choose a backup, 3. restore). No login is needed, like on a fresh install.
import { useState } from 'react';
import { Link } from 'react-router';
import { mdiBackupRestore } from '@mdi/js';
import { useQuery } from '@tanstack/react-query';
import { getBackups, restoreBackup } from '../../api/admin';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { useServerConfig } from '../../hooks/useServer';
import { useRun } from '../../hooks/useRun';
import { t } from '../../i18n';
import { formatBytes } from '../../lib/format';

export default function MaintenanceRestore() {
  const config = useServerConfig();
  const run = useRun();
  const [step, setStep] = useState<'detect' | 'choose' | 'done'>('detect');
  const [chosen, setChosen] = useState('');
  const backups = useQuery({ queryKey: ['backups'], queryFn: getBackups, retry: false, enabled: step === 'choose' });
  const inMaintenance = config.data?.maintenanceMode;

  return (
    <AuthLayout title={t('Maintenance')} wide>
      {step === 'detect' && (
        <div className="flex flex-col items-center gap-4 text-center">
          <Icon path={mdiBackupRestore} size={48} className="text-primary" />
          <p>{inMaintenance ? t('The server is in maintenance mode.') : t('The server is running normally.')}</p>
          <p className="text-sm text-muted">{t('From here you can restore the database from a backup.')}</p>
          <div className="flex gap-2">
            <Link to="/photos">
              <Button variant="outline">{t('Back to the app')}</Button>
            </Link>
            <Button onClick={() => setStep('choose')}>{t('Restore from a backup')}</Button>
          </div>
        </div>
      )}
      {step === 'choose' && (
        <div className="flex flex-col gap-3">
          <h2 className="font-medium">{t('Choose a backup')}</h2>
          {backups.isError && <p className="text-sm text-danger">{(backups.error as Error).message}</p>}
          {(backups.data?.backups ?? []).length === 0 && !backups.isLoading && <p className="text-sm text-muted">{t('No backups were found.')}</p>}
          <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-xl border border-line">
            {(backups.data?.backups ?? []).map((b) => (
              <li key={b.filename}>
                <label className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-panel">
                  <input type="radio" name="backup" checked={chosen === b.filename} onChange={() => setChosen(b.filename)} />
                  <span className="flex-1 text-sm">{b.filename}</span>
                  <span className="text-xs text-muted">{formatBytes(b.filesize)}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep('detect')}>
              {t('Back')}
            </Button>
            <Button disabled={!chosen} onClick={async () => (await run(() => restoreBackup(chosen), { success: t('Restore started') })).ok && setStep('done')}>
              {t('Restore')}
            </Button>
          </div>
        </div>
      )}
      {step === 'done' && (
        <div className="text-center">
          <p className="mb-3">{t('The restore is running. This page works again when the server is back.')}</p>
          <Button onClick={() => location.assign('/')}>{t('Check again')}</Button>
        </div>
      )}
    </AuthLayout>
  );
}
