import { useState } from 'react';
import { previewStorageTemplate } from '../../../../api/admin';
import { Button } from '../../../../components/ui/Button';
import { Select } from '../../../../components/ui/Fields';
import { useRun } from '../../../../hooks/useRun';
import { t } from '../../../../i18n';
import { SchemaFields, type Field } from '../SchemaFields';
import { getPath, useSettings } from '../SettingsContext';

const PRESETS = [
  '{{y}}/{{y}}-{{MM}}-{{dd}}/{{filename}}',
  '{{y}}/{{MM}}-{{dd}}/{{filename}}',
  '{{y}}/{{MMMM}}-{{dd}}/{{filename}}',
  '{{y}}/{{MM}}/{{filename}}',
  '{{y}}/{{MMM}}/{{filename}}',
  '{{y}}/{{MMMM}}/{{filename}}',
  '{{y}}/{{MM}}/{{dd}}/{{filename}}',
  '{{y}}/{{MMMM}}/{{dd}}/{{filename}}',
  '{{y}}/{{y}}-{{MM}}/{{y}}-{{MM}}-{{dd}}/{{filename}}',
];
const VARIABLES = [
  ['{{y}}', 'Year (2024)'],
  ['{{yy}}', 'Year, 2 digits (24)'],
  ['{{MM}} / {{MMM}} / {{MMMM}}', 'Month (05 / May / May)'],
  ['{{dd}}', 'Day (17)'],
  ['{{hh}} {{mm}} {{ss}}', 'Hour, minute, second'],
  ['{{filename}}', 'Original file name without extension'],
  ['{{ext}}', 'File extension'],
  ['{{album}}', 'Album name'],
  ['{{assetId}}', 'Asset ID'],
];

const fields: Field[] = [
  { path: 'storageTemplate.enabled', type: 'switch', label: 'Storage template', help: 'Organise files in the library folder using a template.' },
  { path: 'storageTemplate.hashVerificationEnabled', type: 'switch', label: 'Verify hash when moving files', when: (c) => !!c.storageTemplate?.enabled },
];

/** Template text with presets, a list of variables and a live preview. */
export default function Storage() {
  const { config, set } = useSettings();
  const run = useRun();
  const template = String(getPath(config, 'storageTemplate.template') ?? '');
  const [preview, setPreview] = useState('');
  const enabled = !!getPath(config, 'storageTemplate.enabled');

  return (
    <div className="flex flex-col gap-4">
      <SchemaFields fields={fields} />
      {enabled && (
        <>
          <Select label={t('Preset')} value={PRESETS.includes(template) ? template : ''} onChange={(v) => v && set('storageTemplate.template', v)} options={[{ value: '', label: t('Custom') }, ...PRESETS.map((p) => ({ value: p, label: p }))]} />
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-primary uppercase">{t('Template')}</span>
            <input value={template} onChange={(e) => set('storageTemplate.template', e.target.value)} className="rounded-xl bg-panel px-4 py-2.5 font-mono text-sm ring-1 ring-line outline-none focus:ring-2 focus:ring-primary" />
          </label>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={async () => { const r = await run(() => previewStorageTemplate(template)); if (r.ok) setPreview(r.data.path); }}>
              {t('Preview')}
            </Button>
            {preview && <code className="text-xs break-all">{preview}</code>}
          </div>
          <details className="rounded-xl bg-panel p-3 text-sm">
            <summary className="cursor-pointer font-medium">{t('Variables you can use')}</summary>
            <dl className="mt-2 grid gap-1 sm:grid-cols-2">
              {VARIABLES.map(([name, text]) => (
                <div key={name} className="flex gap-2">
                  <dt className="font-mono text-xs">{name}</dt>
                  <dd className="text-xs text-muted">{t(text)}</dd>
                </div>
              ))}
            </dl>
          </details>
        </>
      )}
    </div>
  );
}
