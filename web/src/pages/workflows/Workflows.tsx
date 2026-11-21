import { lazy, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { mdiContentCopy, mdiDeleteOutline, mdiFileDocumentOutline, mdiPlus, mdiSourceBranch } from '@mdi/js';
import { useQuery } from '@tanstack/react-query';
import { createWorkflow, deleteWorkflow, getWorkflows, updateWorkflow } from '../../api/admin';
import { Boundary } from '../../components/ui/Boundary';
import { Button, IconButton } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Switch } from '../../components/ui/Fields';
import { EmptyState } from '../../components/ui/Misc';
import { PageBody, PageHeader } from '../../components/ui/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { useRun } from '../../hooks/useRun';
import { t } from '../../i18n';
import type { Workflow } from '../../api/types';

const TemplatePicker = lazy(() => import('../../components/modals/WorkflowTemplateModal'));
const LogsModal = lazy(() => import('../../components/modals/WorkflowLogsModal'));

/** Automations: "when something happens, do these steps". */
export default function Workflows() {
  const run = useRun();
  const navigate = useNavigate();
  const list = useQuery({ queryKey: ['workflows'], queryFn: getWorkflows, retry: false });
  const [templates, setTemplates] = useState(false);
  const [logs, setLogs] = useState<Workflow | null>(null);
  const [deleting, setDeleting] = useState<Workflow | null>(null);
  const items = list.data ?? [];

  const create = async (body: Partial<Workflow>) => {
    const r = await run(() => createWorkflow(body), { invalidate: [['workflows']] });
    if (r.ok) navigate(`/workflows/${r.data.id}`);
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t('Workflows')}>
        <Button variant="outline" icon={mdiFileDocumentOutline} onClick={() => setTemplates(true)}>
          <span className="max-md:hidden">{t('From a template')}</span>
        </Button>
        <Button icon={mdiPlus} onClick={() => create({ name: t('New workflow'), trigger: 'AssetCreate', enabled: false, steps: [] })}>
          <span className="max-md:hidden">{t('Create workflow')}</span>
        </Button>
      </PageHeader>
      <PageBody>
        {list.isLoading && <PageSpinner />}
        {!list.isLoading && items.length === 0 && <EmptyState icon={mdiSourceBranch} title={t('No workflows yet')} text={t('Workflows run steps automatically, for example when a photo is uploaded.')} />}
        <ul className="grid gap-3">
          {items.map((w) => (
            <li key={w.id} className="flex items-center gap-4 rounded-2xl border border-line bg-panel-2 p-4">
              <Link to={`/workflows/${w.id}`} className="min-w-0 flex-1">
                <p className="truncate font-medium hover:underline">{w.name}</p>
                <p className="text-xs text-muted">
                  {w.trigger} · {t('{count} steps', { count: w.steps.length })}
                </p>
                {w.description && <p className="truncate text-sm text-muted">{w.description}</p>}
              </Link>
              <Switch label={t('Enabled')} checked={w.enabled} onChange={(enabled) => run(() => updateWorkflow(w.id, { enabled }), { invalidate: [['workflows']] })} />
              <Button size="sm" variant="ghost" onClick={() => setLogs(w)}>
                {t('Logs')}
              </Button>
              <IconButton path={mdiContentCopy} label={t('Duplicate')} onClick={() => create({ ...w, id: undefined, name: `${w.name} (${t('copy')})`, enabled: false } as Partial<Workflow>)} />
              <IconButton path={mdiDeleteOutline} label={t('Delete')} onClick={() => setDeleting(w)} />
            </li>
          ))}
        </ul>
      </PageBody>
      <Boundary compact fallback={null}>
        {templates && <TemplatePicker onClose={() => setTemplates(false)} onPick={(w) => (setTemplates(false), create(w))} />}
        {logs && <LogsModal workflow={logs} onClose={() => setLogs(null)} />}
      </Boundary>
      {deleting && <ConfirmDialog title={t('Delete workflow?')} message={deleting.name} confirmText="Delete" danger onClose={() => setDeleting(null)} onConfirm={() => run(() => deleteWorkflow(deleting.id), { success: t('Workflow deleted'), invalidate: [['workflows']] })} />}
    </div>
  );
}
