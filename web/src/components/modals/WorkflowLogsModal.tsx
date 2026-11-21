import { useQuery } from '@tanstack/react-query';
import { getWorkflowLogs } from '../../api/admin';
import type { Workflow } from '../../api/types';
import { t } from '../../i18n';
import { formatDateTime } from '../../lib/format';
import { Modal } from '../ui/Modal';
import { PageSpinner } from '../ui/Spinner';

export default function WorkflowLogsModal({ workflow, onClose }: { workflow: Workflow; onClose: () => void }) {
  const logs = useQuery({ queryKey: ['workflow-logs', workflow.id], queryFn: () => getWorkflowLogs(workflow.id), retry: false });
  return (
    <Modal title={t('Logs: {name}', { name: workflow.name })} size="lg" onClose={onClose}>
      {logs.isLoading && <PageSpinner />}
      {logs.isError && <p className="text-sm text-muted">{(logs.error as Error).message}</p>}
      {!logs.isLoading && !logs.isError && (logs.data?.length ?? 0) === 0 && <p className="text-sm text-muted">{t('Nothing has run yet.')}</p>}
      <ul className="space-y-1 font-mono text-xs">
        {(logs.data ?? []).map((l) => (
          <li key={l.id}>
            <span className="text-muted">{formatDateTime(l.createdAt)}</span> <span className={l.level === 'error' ? 'text-danger' : ''}>[{l.level}]</span> {l.message}
          </li>
        ))}
      </ul>
    </Modal>
  );
}
