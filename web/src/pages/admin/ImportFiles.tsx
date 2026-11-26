import { useEffect, useRef, useState } from 'react';
import { mdiFolderDownloadOutline, mdiRefresh } from '@mdi/js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getAdminUsers, getImportFiles, importFile, type ImportResult } from '../../api/admin';
import { errorMessage } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Fields';
import { EmptyState } from '../../components/ui/Misc';
import { PageBody, PageHeader } from '../../components/ui/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { t } from '../../i18n';
import { cx } from '../../lib/cx';
import { formatBytes, formatDateTime } from '../../lib/format';

type RowStatus = ImportResult['status'] | 'uploading';
const STATUS: Record<RowStatus, [label: string, color: string]> = {
  uploading: ['Checking…', 'text-primary'],
  uploaded: ['Uploaded', 'text-primary'],
  duplicate: ['Already uploaded', 'text-muted'],
  unsupported: ['Not supported', 'text-warning'],
  waiting: ['Still copying', 'text-warning'],
  failed: ['Failed', 'text-danger'],
};

/** Import the files copied into the server's import-files folder into a chosen user's library, one by one. */
export default function ImportFiles() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState('');
  const [results, setResults] = useState<Record<string, { status: RowStatus; message?: string }>>({});
  const [running, setRunning] = useState(false);
  const stop = useRef(false);

  const users = useQuery({ queryKey: ['admin-users', 'active'], queryFn: () => getAdminUsers(false) });
  // the list is only reloaded on purpose, so uploaded files keep their row and result after they left the folder
  const folder = useQuery({ queryKey: ['import-files'], queryFn: getImportFiles, staleTime: Infinity, refetchOnMount: 'always' });
  const files = folder.data?.files ?? [];

  // leaving the page stops after the file in progress
  useEffect(() => {
    stop.current = false;
    return () => {
      stop.current = true;
    };
  }, []);

  const refresh = () => {
    setResults({});
    void folder.refetch();
  };

  const runImport = async () => {
    stop.current = false;
    setRunning(true);
    setResults({});
    try {
      const fresh = (await folder.refetch()).data?.files ?? [];
      for (const { name } of fresh) {
        if (stop.current) break;
        setResults((r) => ({ ...r, [name]: { status: 'uploading' } }));
        const result = await importFile(userId, name).catch((error): ImportResult => ({ status: 'failed', message: errorMessage(error) }));
        setResults((r) => ({ ...r, [name]: result }));
      }
    } finally {
      setRunning(false);
      qc.invalidateQueries({ queryKey: ['timeline'] });
    }
  };

  const count = (status: RowStatus) => Object.values(results).filter((r) => r.status === status).length;
  const done = Object.values(results).filter((r) => r.status !== 'uploading').length;

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t('Import files')}>
        <Button variant="outline" icon={mdiRefresh} disabled={running} onClick={refresh}>
          <span className="max-md:hidden">{t('Refresh')}</span>
        </Button>
        {running ? (
          <Button variant="danger-outline" onClick={() => (stop.current = true)}>
            {t('Stop')}
          </Button>
        ) : (
          <Button icon={mdiFolderDownloadOutline} disabled={!userId || files.length === 0} onClick={runImport}>
            {t('Import')}
          </Button>
        )}
      </PageHeader>
      <PageBody>
        <div className="mb-4 max-w-md">
          <Select
            label={t('Upload to user')}
            value={userId}
            disabled={running}
            onChange={(id) => (setUserId(id), setResults({}))}
            options={[{ value: '', label: t('Choose a user') }, ...(users.data ?? []).map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }))]}
          />
        </div>
        {folder.data && (
          <p className="mb-4 text-sm text-muted">
            {t('Copy photos and videos into this folder on the server:')} <span className="font-mono break-all">{folder.data.folder}</span>.{' '}
            {t('A new file moves to the user. A file the user already has stays in the folder.')}
          </p>
        )}
        {done > 0 && (
          <p className="mb-3 text-sm" role="status">
            {t('{done} of {total} checked: {uploaded} uploaded, {duplicate} already uploaded, {other} not uploaded', {
              done,
              total: files.length,
              uploaded: count('uploaded'),
              duplicate: count('duplicate'),
              other: count('failed') + count('unsupported') + count('waiting'),
            })}
          </p>
        )}
        {folder.isLoading && <PageSpinner />}
        {folder.error && <p className="text-sm text-danger">{errorMessage(folder.error)}</p>}
        {folder.data && files.length === 0 && <EmptyState icon={mdiFolderDownloadOutline} title={t('The folder is empty')} text={t('Copy files into it, then press Refresh.')} />}
        {files.length > 0 && (
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {files.map((f) => {
              const result = results[f.name];
              const [label, color] = result ? STATUS[result.status] : f.supported ? ['Not checked', 'text-muted'] : STATUS.unsupported;
              return (
                <li key={f.name} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm break-all">{f.name}</div>
                    <div className="text-xs text-muted">
                      {formatBytes(f.size)} · {formatDateTime(f.modifiedAt)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={cx('text-sm font-medium', color)}>{t(label)}</div>
                    {result?.message && <div className="text-xs text-muted">{result.message}</div>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </PageBody>
    </div>
  );
}
