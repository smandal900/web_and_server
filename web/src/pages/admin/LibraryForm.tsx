import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { mdiClose, mdiPlus } from '@mdi/js';
import { useQuery } from '@tanstack/react-query';
import { createLibrary, getLibrary, updateLibrary } from '../../api/admin';
import { Button, IconButton } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Fields';
import { Card } from '../../components/ui/Misc';
import { PageBody, PageHeader } from '../../components/ui/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { useRun } from '../../hooks/useRun';
import { t } from '../../i18n';

/** Add, edit and remove entries of a list of text values (folders, exclusion patterns). */
function StringList({ title, help, placeholder, values, onChange }: { title: string; help: string; placeholder: string; values: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState('');
  const add = () => {
    const v = text.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setText('');
  };
  return (
    <Card title={title}>
      <p className="mb-3 text-sm text-muted">{help}</p>
      <ul className="mb-3 divide-y divide-line">
        {values.map((v, i) => (
          <li key={v} className="flex items-center gap-2 py-1">
            <input value={v} onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))} className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1 font-mono text-sm hover:bg-panel focus:bg-panel" aria-label={title} />
            <IconButton path={mdiClose} label={t('Remove')} size={18} onClick={() => onChange(values.filter((_, j) => j !== i))} />
          </li>
        ))}
        {values.length === 0 && <li className="py-1 text-sm text-muted">{t('None yet.')}</li>}
      </ul>
      <div className="flex gap-2">
        <div className="flex-1">
          <TextField placeholder={placeholder} value={text} onChange={setText} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} />
        </div>
        <Button variant="outline" icon={mdiPlus} onClick={add} disabled={!text.trim()}>
          {t('Add')}
        </Button>
      </div>
    </Card>
  );
}

/** /admin/library-management/new, /:id (detail) and /:id/edit share this form. */
export default function LibraryForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const run = useRun();
  const existing = useQuery({ queryKey: ['library', id], queryFn: () => getLibrary(id!), enabled: !!id, retry: false });
  const [name, setName] = useState('');
  const [paths, setPaths] = useState<string[]>([]);
  const [patterns, setPatterns] = useState<string[]>([]);

  useEffect(() => {
    const l = existing.data;
    if (l) (setName(l.name), setPaths(l.importPaths), setPatterns(l.exclusionPatterns));
  }, [existing.data]);

  if (id && existing.isLoading) return <PageSpinner />;
  const save = async () => {
    const body = { name, importPaths: paths, exclusionPatterns: patterns };
    const r = await run(() => (id ? updateLibrary(id, body) : createLibrary(body)), { success: t('Library saved'), invalidate: [['libraries'], ['library', id]] });
    if (r.ok) navigate('/admin/library-management');
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={id ? t('Edit library') : t('Create library')}>
        <Button variant="outline" onClick={() => navigate('/admin/library-management')}>
          {t('Cancel')}
        </Button>
        <Button disabled={!name.trim()} onClick={save}>
          {t('Save')}
        </Button>
      </PageHeader>
      <PageBody narrow>
        <div className="flex flex-col gap-4">
          {id && existing.isError && <p className="text-sm text-danger">{(existing.error as Error).message}</p>}
          <TextField label={t('Name')} value={name} onChange={setName} />
          <StringList title={t('Folders')} help={t('Folders on the server that are scanned for pictures.')} placeholder="/mnt/photos" values={paths} onChange={setPaths} />
          <StringList title={t('Exclusion patterns')} help={t('Files and folders matching these patterns are skipped. Example: **/Raw/**')} placeholder="**/Raw/**" values={patterns} onChange={setPatterns} />
        </div>
      </PageBody>
    </div>
  );
}
