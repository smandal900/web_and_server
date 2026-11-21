import { lazy, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import {
  mdiAccountCogOutline,
  mdiBellOutline,
  mdiCloudUploadOutline,
  mdiCodeBraces,
  mdiCogOutline,
  mdiDatabaseCogOutline,
  mdiDeleteOutline,
  mdiEmailOutline,
  mdiFileDocumentOutline,
  mdiImageOutline,
  mdiKeyChainVariant,
  mdiMapOutline,
  mdiPaletteOutline,
  mdiUpdate,
  mdiVideoOutline,
  mdiFileTreeOutline,
} from '@mdi/js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getAdminConfig, getAdminDefaults, saveAdminConfig } from '../../api/admin';
import type { AdminConfig } from '../../api/types';
import { Boundary } from '../../components/ui/Boundary';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Accordion } from '../../components/ui/Misc';
import { PageBody, PageHeader } from '../../components/ui/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { useRun } from '../../hooks/useRun';
import { t } from '../../i18n';
import { SettingsContext, setPath } from './settings/SettingsContext';

const load = (fn: () => Promise<{ default: ComponentType }>) => lazy(fn);
// One entry per group of settings. The file behind it downloads when the section is opened.
const SECTIONS = [
  { id: 'ffmpeg', title: 'Video transcoding', text: 'Codecs, quality and hardware acceleration', icon: mdiVideoOutline, Body: load(() => import('./settings/sections/Ffmpeg')) },
  { id: 'image', title: 'Image settings', text: 'Thumbnails, previews and full-size images', icon: mdiImageOutline, Body: load(() => import('./settings/sections/Image')) },
  { id: 'map', title: 'Map & location', text: 'Map styles and reverse geocoding', icon: mdiMapOutline, Body: load(() => import('./settings/sections/MapSettings')) },
  { id: 'auth', title: 'Authentication', text: 'Password, passkeys and OAuth', icon: mdiKeyChainVariant, Body: load(() => import('./settings/sections/Auth')) },
  { id: 'server', title: 'Server', text: 'Domain, login message and visibility', icon: mdiCogOutline, Body: load(() => import('./settings/sections/Server')) },
  { id: 'storage', title: 'Storage template', text: 'How files are named and placed', icon: mdiFileTreeOutline, Body: load(() => import('./settings/sections/Storage')) },
  { id: 'trash', title: 'Trash', text: 'Keep deleted pictures for a while', icon: mdiDeleteOutline, Body: load(() => import('./settings/sections/Trash')) },
  { id: 'upload', title: 'Uploads', text: 'Chunk size and resume window', icon: mdiCloudUploadOutline, Body: load(() => import('./settings/sections/Upload')) },
  { id: 'user', title: 'User settings', text: 'Account deletion delay', icon: mdiAccountCogOutline, Body: load(() => import('./settings/sections/UserSettings')) },
  { id: 'logging', title: 'Logging', text: 'Server log level', icon: mdiFileDocumentOutline, Body: load(() => import('./settings/sections/Logging')) },
  { id: 'theme', title: 'Theme', text: 'Custom CSS', icon: mdiPaletteOutline, Body: load(() => import('./settings/sections/Theme')) },
  { id: 'notifications', title: 'Email notifications', text: 'SMTP server', icon: mdiBellOutline, Body: load(() => import('./settings/sections/Notifications')) },
  { id: 'templates', title: 'Email templates', text: 'Custom email designs', icon: mdiEmailOutline, Body: load(() => import('./settings/sections/Templates')) },
  { id: 'metadata', title: 'Metadata', text: 'Reading extra information from files', icon: mdiDatabaseCogOutline, Body: load(() => import('./settings/sections/Metadata')) },
  { id: 'version', title: 'Version check', text: 'Look for new releases', icon: mdiUpdate, Body: load(() => import('./settings/sections/VersionCheck')) },
];

export default function SystemSettings() {
  const run = useRun();
  const qc = useQueryClient();
  const server = useQuery({ queryKey: ['admin-config'], queryFn: getAdminConfig });
  const defaults = useQuery({ queryKey: ['admin-defaults'], queryFn: getAdminDefaults, staleTime: Infinity });
  const [draft, setDraft] = useState<AdminConfig>();
  const [confirmReset, setConfirmReset] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (server.data) setDraft(server.data);
  }, [server.data]);

  const dirty = useMemo(() => !!draft && JSON.stringify(draft) !== JSON.stringify(server.data), [draft, server.data]);
  if (!draft || !server.data || !defaults.data) return <PageSpinner />;

  const save = async () => {
    const r = await run(() => saveAdminConfig(draft), { success: t('Settings saved') });
    if (r.ok) {
      qc.setQueryData(['admin-config'], r.data);
      setDraft(r.data);
      // Public values (map style, features, login message...) may have changed too.
      for (const key of ['server-config', 'features', 'public-config', 'user-config']) qc.invalidateQueries({ queryKey: [key] });
    }
  };

  const exportJson = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' }));
    Object.assign(document.createElement('a'), { href: url, download: 'system-config.json' }).click();
    URL.revokeObjectURL(url);
  };
  const importJson = async (f?: File) => {
    if (!f) return;
    try {
      setDraft({ ...draft, ...JSON.parse(await f.text()) });
    } catch {
      run(async () => {
        throw new Error(t('That file is not valid JSON.'));
      });
    }
  };

  return (
    <SettingsContext.Provider value={{ config: draft, defaults: defaults.data, saved: server.data, set: (path, value) => setDraft((d) => setPath(d!, path, value)) }}>
      <div className="flex h-full flex-col">
        <PageHeader title={t('System settings')}>
          <input ref={file} type="file" accept="application/json" hidden onChange={(e) => importJson(e.target.files?.[0])} />
          <Button variant="ghost" icon={mdiCodeBraces} onClick={exportJson}>
            <span className="max-lg:hidden">{t('Export')}</span>
          </Button>
          <Button variant="ghost" onClick={() => file.current?.click()}>
            <span className="max-lg:hidden">{t('Import')}</span>
          </Button>
          <Button variant="outline" onClick={() => setConfirmReset(true)}>
            {t('Reset to defaults')}
          </Button>
          <Button disabled={!dirty} onClick={save}>
            {t('Save')}
          </Button>
        </PageHeader>
        <PageBody narrow>
          {dirty && <p className="mb-3 rounded-xl bg-warning/10 p-3 text-sm">{t('You have unsaved changes. Fields with a • were changed.')}</p>}
          <div className="flex flex-col gap-3">
            {SECTIONS.map(({ id, title, text, icon, Body }) => (
              <Accordion key={id} title={t(title)} subtitle={t(text)} icon={icon}>
                <Boundary compact>
                  <Body />
                </Boundary>
              </Accordion>
            ))}
          </div>
        </PageBody>
        {confirmReset && (
          <ConfirmDialog
            title={t('Reset all settings?')}
            message={t('Every field returns to its default. Nothing is saved until you press Save.')}
            confirmText="Reset"
            danger
            onClose={() => setConfirmReset(false)}
            onConfirm={() => setDraft(defaults.data)}
          />
        )}
      </div>
    </SettingsContext.Provider>
  );
}
