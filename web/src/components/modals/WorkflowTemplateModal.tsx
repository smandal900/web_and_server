import { useQuery } from '@tanstack/react-query';
import { getWorkflowTemplates } from '../../api/admin';
import type { Workflow } from '../../api/types';
import { t } from '../../i18n';
import { Modal } from '../ui/Modal';
import { PageSpinner } from '../ui/Spinner';

/** Start a workflow from a ready-made template offered by the server's plugins. */
export default function WorkflowTemplateModal({ onPick, onClose }: { onPick: (w: Partial<Workflow>) => void; onClose: () => void }) {
  const templates = useQuery({ queryKey: ['workflow-templates'], queryFn: getWorkflowTemplates, retry: false });
  return (
    <Modal title={t('Choose a template')} onClose={onClose}>
      {templates.isLoading && <PageSpinner />}
      {templates.isError && <p className="text-sm text-muted">{(templates.error as Error).message}</p>}
      {!templates.isLoading && !templates.isError && (templates.data?.length ?? 0) === 0 && <p className="text-sm text-muted">{t('The server has no templates yet.')}</p>}
      <ul className="divide-y divide-line">
        {(templates.data ?? []).map((tpl) => (
          <li key={tpl.name}>
            <button onClick={() => onPick({ ...tpl.workflow, name: tpl.workflow.name ?? tpl.name })} className="w-full px-2 py-3 text-left hover:bg-panel">
              <p className="font-medium">{tpl.name}</p>
              {tpl.description && <p className="text-sm text-muted">{tpl.description}</p>}
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
