import { useState } from 'react';
import { previewEmailTemplate } from '../../../../api/admin';
import { Button } from '../../../../components/ui/Button';
import { TextArea } from '../../../../components/ui/Fields';
import { Modal } from '../../../../components/ui/Modal';
import { useRun } from '../../../../hooks/useRun';
import { t } from '../../../../i18n';
import { getPath, useSettings } from '../SettingsContext';

const TEMPLATES = [
  { key: 'welcomeTemplate', name: 'welcome', label: 'Welcome email' },
  { key: 'albumInviteTemplate', name: 'album-invite', label: 'Album invitation email' },
  { key: 'albumUpdateTemplate', name: 'album-update', label: 'Album update email' },
];

/** Custom HTML for each email. Leave empty for the built-in design. "Preview" renders it with sample data. */
export default function Templates() {
  const { config, set } = useSettings();
  const run = useRun();
  const [html, setHtml] = useState<string | null>(null);

  const preview = async (name: string, template: string) => {
    const r = await run(() => previewEmailTemplate(name, template));
    if (r.ok) setHtml(r.data.html);
  };

  return (
    <div className="flex flex-col gap-5">
      {TEMPLATES.map((tpl) => {
        const path = `templates.email.${tpl.key}`;
        const value = String(getPath(config, path) ?? '');
        return (
          <div key={tpl.key} className="flex flex-col gap-2">
            <TextArea label={t(tpl.label)} rows={6} className="font-mono" value={value} onChange={(v) => set(path, v)} />
            <div>
              <Button variant="outline" size="sm" onClick={() => preview(tpl.name, value)}>
                {t('Preview')}
              </Button>
            </div>
          </div>
        );
      })}
      {html !== null && (
        <Modal title={t('Email preview')} size="lg" onClose={() => setHtml(null)}>
          <iframe title="Email preview" sandbox="" srcDoc={html} className="h-[60vh] w-full rounded-lg bg-white" />
        </Modal>
      )}
    </div>
  );
}
