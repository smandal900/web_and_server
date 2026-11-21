import { useState } from 'react';
import { Link } from 'react-router';
import { mdiBackupRestore, mdiDatabaseOutline, mdiDeleteOutline, mdiPlus, mdiRestart } from '@mdi/js';
import { useQuery } from '@tanstack/react-query';
import { createBackup, deleteBackup, getBackups, getIntegritySummary, restartServer, restoreBackup } from '../../api/admin';
import { Button, IconButton } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Icon } from '../../components/ui/Icon';
import { Card } from '../../components/ui/Misc';
import { PageBody, PageHeader } from '../../components/ui/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { useRun } from '../../hooks/useRun';
import { t } from '../../i18n';
import { formatBytes } from '../../lib/format';

const INTEGRITY_LABELS: Record<string, string> = {
  checksum_mismatch: 'Checksum mismatches',
  missing_file: 'Missing files',
  untracked_file: 'Untracked files',
};

/** Housekeeping: file integrity checks, database backups, and restarting the server. */
export default function Maintenance() {
  const run = useRun();
  const summary = useQuery({ queryKey: ['integrity'], queryFn: getIntegritySummary, retry: false });
  const backups = useQuery({ queryKey: ['backups'], queryFn: getBackups, retry: false });
  const [action, setAction] = useState<{ kind: 'restore' | 'delete' | 'restart'; name?: string } | null>(null);
  const list = backups.data?.backups ?? [];

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t('Maintenance')}>
        <Button variant="outline" icon={mdiRestart} onClick={() => setAction({ kind: 'restart' })}>
          <span className="max-md:hidden">{t('Restart server')}</span>
        </Button>
      </PageHeader>
      <PageBody>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title={t('File integrity')}>
            {summary.isLoading ? (
              <PageSpinner />
            ) : (
              <ul className="divide-y divide-line">
                {Object.entries(summary.data ?? {}).map(([type, count]) => (
                  <li key={type}>
                    <Link to={`/admin/maintenance/integrity-report/${type}`} className="flex items-center justify-between py-2 hover:text-primary">
                      <span>{t(INTEGRITY_LABELS[type] ?? type)}</span>
                      <span className={count > 0 ? 'font-semibold text-danger' : 'text-muted'}>{count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card
            title={t('Database backups')}
            actions={
              <Button size="sm" icon={mdiPlus} onClick={() => run(() => createBackup(), { success: t('Backup started'), invalidate: [['backups']] })}>
                {t('Create backup')}
              </Button>
            }
          >
            {backups.isLoading && <PageSpinner />}
            {!backups.isLoading && list.length === 0 && <p className="text-sm text-muted">{t('There are no backups yet.')}</p>}
            <ul className="divide-y divide-line">
              {list.map((b) => (
                <li key={b.filename} className="flex items-center gap-2 py-2">
                  <Icon path={mdiDatabaseOutline} className="text-muted" />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="truncate">{b.filename}</p>
                    <p className="text-xs text-muted">{formatBytes(b.filesize)}</p>
                  </div>
                  <IconButton path={mdiBackupRestore} label={t('Restore')} size={20} onClick={() => setAction({ kind: 'restore', name: b.filename })} />
                  <IconButton path={mdiDeleteOutline} label={t('Delete')} size={20} onClick={() => setAction({ kind: 'delete', name: b.filename })} />
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </PageBody>

      {action?.kind === 'restore' && <ConfirmDialog title={t('Restore this backup?')} message={t('The server goes into maintenance mode and replaces the database with "{name}".', { name: action.name! })} confirmText="Restore" danger onClose={() => setAction(null)} onConfirm={() => run(() => restoreBackup(action.name!), { success: t('Restore started') })} />}
      {action?.kind === 'delete' && <ConfirmDialog title={t('Delete this backup?')} message={action.name} confirmText="Delete" danger onClose={() => setAction(null)} onConfirm={() => run(() => deleteBackup(action.name!), { success: t('Backup deleted'), invalidate: [['backups']] })} />}
      {action?.kind === 'restart' && <ConfirmDialog title={t('Restart the server?')} message={t('Everyone is disconnected for a moment.')} confirmText="Restart" onClose={() => setAction(null)} onConfirm={() => run(() => restartServer(), { success: t('Restarting...') })} />}
    </div>
  );
}

