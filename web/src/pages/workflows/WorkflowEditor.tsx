import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { mdiArrowDown, mdiArrowUp, mdiDeleteOutline, mdiPlus } from '@mdi/js';
import { useQuery } from '@tanstack/react-query';
import { getAlbums, getTags } from '../../api/library';
import { getPluginMethods, getWorkflow, getWorkflowTriggers, updateWorkflow, type WorkflowMethod } from '../../api/admin';
import type { Workflow, WorkflowStep } from '../../api/types';
import { Button, IconButton } from '../../components/ui/Button';
import { Checkbox, NumberField, Select, Switch, TextArea, TextField } from '../../components/ui/Fields';
import { Card } from '../../components/ui/Misc';
import { PageBody, PageHeader } from '../../components/ui/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { useRun } from '../../hooks/useRun';
import { t } from '../../i18n';

/** One field of a step, drawn from the plugin's own schema (text, number, switch, album or tag picker). */
function ConfigField({ field, value, onChange }: { field: NonNullable<WorkflowMethod['schema']>[number]; value: unknown; onChange: (v: unknown) => void }) {
  const albums = useQuery({ queryKey: ['albums'], queryFn: () => getAlbums(), enabled: field.type === 'album', retry: false });
  const tags = useQuery({ queryKey: ['tags'], queryFn: getTags, enabled: field.type === 'tag', retry: false });
  switch (field.type) {
    case 'boolean':
      return <Checkbox label={field.label} checked={!!value} onChange={onChange} />;
    case 'number':
      return <NumberField label={field.label} value={value as number | undefined} onChange={onChange} />;
    case 'select':
      return <Select label={field.label} value={String(value ?? '')} onChange={onChange} options={(field.options ?? []).map((o) => ({ value: o, label: o }))} />;
    case 'album':
      return <Select label={field.label} value={String(value ?? '')} onChange={onChange} options={[{ value: '', label: t('Choose an album') }, ...(albums.data ?? []).map((a) => ({ value: a.id, label: a.albumName }))]} />;
    case 'tag':
      return <Select label={field.label} value={String(value ?? '')} onChange={onChange} options={[{ value: '', label: t('Choose a tag') }, ...(tags.data ?? []).map((x) => ({ value: x.id, label: x.value }))]} />;
    default:
      return <TextField label={field.label} value={String(value ?? '')} onChange={onChange} />;
  }
}

export default function WorkflowEditor() {
  const { workflowId = '' } = useParams();
  const navigate = useNavigate();
  const run = useRun();
  const workflow = useQuery({ queryKey: ['workflow', workflowId], queryFn: () => getWorkflow(workflowId), retry: false });
  const triggers = useQuery({ queryKey: ['workflow-triggers'], queryFn: getWorkflowTriggers, retry: false });
  const methods = useQuery({ queryKey: ['plugin-methods'], queryFn: getPluginMethods, retry: false });
  const [draft, setDraft] = useState<Workflow>();
  useEffect(() => setDraft(workflow.data), [workflow.data]);

  if (workflow.isLoading) return <PageSpinner />;
  if (!draft) return <PageBody>{workflow.isError ? <p className="text-danger">{(workflow.error as Error).message}</p> : null}</PageBody>;

  const methodList = methods.data ?? [];
  const setStep = (i: number, step: WorkflowStep) => setDraft({ ...draft, steps: draft.steps.map((s, j) => (j === i ? step : s)) });
  const move = (i: number, d: -1 | 1) => {
    const steps = [...draft.steps];
    [steps[i], steps[i + d]] = [steps[i + d], steps[i]];
    setDraft({ ...draft, steps });
  };
  const save = async () => {
    const r = await run(() => updateWorkflow(draft.id, draft), { success: t('Workflow saved'), invalidate: [['workflows'], ['workflow', draft.id]] });
    if (r.ok) navigate('/workflows');
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={draft.name || t('Workflow')}>
        <Button variant="outline" onClick={() => navigate('/workflows')}>
          {t('Cancel')}
        </Button>
        <Button onClick={save}>{t('Save')}</Button>
      </PageHeader>
      <PageBody narrow>
        <div className="flex flex-col gap-4">
          <TextField label={t('Name')} value={draft.name} onChange={(name) => setDraft({ ...draft, name })} />
          <TextArea label={t('Description')} value={draft.description ?? ''} onChange={(description) => setDraft({ ...draft, description })} />
          <Select
            label={t('Trigger')}
            help={t('What starts this workflow')}
            value={draft.trigger}
            onChange={(trigger) => setDraft({ ...draft, trigger })}
            options={[{ value: draft.trigger, label: draft.trigger }, ...(triggers.data ?? []).filter((x) => x.name !== draft.trigger).map((x) => ({ value: x.name, label: x.title }))]}
          />
          <Switch label={t('Enabled')} checked={draft.enabled} onChange={(enabled) => setDraft({ ...draft, enabled })} />

          <h2 className="mt-2 font-semibold">{t('Steps')}</h2>
          {draft.steps.map((step, i) => {
            const method = methodList.find((m) => m.name === step.method);
            return (
              <Card
                key={i}
                title={`${i + 1}. ${method?.title ?? step.method}`}
                actions={
                  <div className="flex">
                    <IconButton path={mdiArrowUp} label={t('Move up')} size={18} disabled={i === 0} onClick={() => move(i, -1)} />
                    <IconButton path={mdiArrowDown} label={t('Move down')} size={18} disabled={i === draft.steps.length - 1} onClick={() => move(i, 1)} />
                    <IconButton path={mdiDeleteOutline} label={t('Remove step')} size={18} onClick={() => setDraft({ ...draft, steps: draft.steps.filter((_, j) => j !== i) })} />
                  </div>
                }
              >
                <div className="flex flex-col gap-3">
                  <Select label={t('Action')} value={step.method} onChange={(m) => setStep(i, { ...step, method: m, config: {} })} options={[{ value: step.method, label: method?.title ?? step.method }, ...methodList.filter((m) => m.name !== step.method).map((m) => ({ value: m.name, label: m.title }))]} />
                  {method?.description && <p className="text-xs text-muted">{method.description}</p>}
                  {(method?.schema ?? []).map((field) => (
                    <ConfigField key={field.key} field={field} value={step.config[field.key]} onChange={(v) => setStep(i, { ...step, config: { ...step.config, [field.key]: v } })} />
                  ))}
                </div>
              </Card>
            );
          })}
          <Button variant="outline" icon={mdiPlus} onClick={() => setDraft({ ...draft, steps: [...draft.steps, { method: methodList[0]?.name ?? '', config: {} }] })}>
            {t('Add step')}
          </Button>
          {methods.isError && <p className="text-xs text-muted">{t('The list of available actions could not be loaded.')}</p>}
        </div>
      </PageBody>
    </div>
  );
}
