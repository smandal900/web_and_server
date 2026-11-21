import { useState } from 'react';
import { mdiAlertOctagonOutline, mdiDeleteSweepOutline } from '@mdi/js';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { clearErrorLogs, getErrorLogs } from '../../api/core';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Select, TextField } from '../../components/ui/Fields';
import { EmptyState } from '../../components/ui/Misc';
import { PageBody, PageHeader } from '../../components/ui/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { useRun } from '../../hooks/useRun';
import { t } from '../../i18n';
import { cx } from '../../lib/cx';
import { formatDateTime } from '../../lib/format';

const LEVEL_COLOR: Record<string, string> = { warn: 'text-warning', error: 'text-danger', fatal: 'text-danger font-bold' };

/** Errors reported by the server itself and by browsers (this web app sends its crashes here). */
export default function ErrorLog() {
  const run = useRun();
  const [filters, setFilters] = useState({ level: '', source: '', section: '', search: '' });
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const set = (k: keyof typeof filters) => (v: string) => (setFilters((f) => ({ ...f, [k]: v })), setPage(1));

  const logs = useQuery({ queryKey: ['error-logs', filters, page], queryFn: () => getErrorLogs({ ...filters, page, size: 25 }), placeholderData: keepPreviousData });
  const data = logs.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;
  const options = (values: Array<[string, string]>) => [{ value: '', label: t('All') }, ...values.map(([value, label]) => ({ value, label }))];

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t('Error log')}>
        <Button variant="danger-outline" icon={mdiDeleteSweepOutline} disabled={!data?.total} onClick={() => setConfirm(true)}>
          <span className="max-md:hidden">{t('Clear all')}</span>
        </Button>
      </PageHeader>
      <PageBody>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TextField placeholder={t('Search messages and paths')} value={filters.search} onChange={set('search')} />
          <Select value={filters.level} onChange={set('level')} options={options([['warn', 'Warning'], ['error', 'Error'], ['fatal', 'Fatal']])} aria-label={t('Level')} />
          <Select value={filters.source} onChange={set('source')} options={options([['api', 'Server'], ['service', 'Service'], ['web', 'Web app']])} aria-label={t('Source')} />
          <Select value={filters.section} onChange={set('section')} options={options((data?.sections ?? []).map((s) => [s.section, `${s.section || '(none)'} (${s.count})`]))} aria-label={t('Section')} />
        </div>
        {logs.isLoading && <PageSpinner />}
        {data && data.items.length === 0 && <EmptyState icon={mdiAlertOctagonOutline} title={t('No errors')} text={t('Nothing matches, or the log is clean.')} />}
        <ul className="divide-y divide-line rounded-2xl border border-line">
          {data?.items.map((e) => (
            <li key={e.id}>
              <button className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-panel-2" onClick={() => setOpen(open === e.id ? null : e.id)}>
                <span className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={cx('uppercase', LEVEL_COLOR[e.level])}>{e.level}</span>
                  <span className="rounded bg-panel px-1.5 py-0.5">{e.source}</span>
                  {e.section && <span className="rounded bg-panel px-1.5 py-0.5">{e.section}</span>}
                  <span className="text-muted">{formatDateTime(e.createdAt)}</span>
                  {e.method && <span className="font-mono text-muted">{e.method} {e.path} {e.status}</span>}
                </span>
                <span className="text-sm">{e.message}</span>
              </button>
              {open === e.id && e.stack && <pre className="overflow-x-auto bg-panel px-4 py-3 text-xs">{e.stack}</pre>}
            </li>
          ))}
        </ul>
        {data && data.total > data.size && (
          <div className="mt-4 flex items-center justify-center gap-3">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              {t('Previous')}
            </Button>
            <span className="text-sm text-muted">{t('Page {page} of {pages}', { page, pages })}</span>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
              {t('Next')}
            </Button>
          </div>
        )}
      </PageBody>
      {confirm && (
        <ConfirmDialog
          title={t('Clear the error log?')}
          message={t('All {count} entries are deleted.', { count: data?.total ?? 0 })}
          confirmText="Clear all"
          danger
          onClose={() => setConfirm(false)}
          onConfirm={() => run(() => clearErrorLogs(), { success: t('Log cleared'), invalidate: [['error-logs']] })}
        />
      )}
    </div>
  );
}
