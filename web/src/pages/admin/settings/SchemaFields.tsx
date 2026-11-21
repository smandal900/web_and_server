// Draws settings fields from a plain list, so each settings section is just a description of its fields.
import { Checkbox, NumberField, Select, Switch, TextArea, TextField } from '../../../components/ui/Fields';
import { t } from '../../../i18n';
import { cx } from '../../../lib/cx';
import { getPath, useSettings } from './SettingsContext';

interface Base {
  path: string;
  label: string;
  help?: string;
  /** Only show when this returns true for the whole config (e.g. hide ffmpeg options while transcoding is off). */
  when?: (config: Record<string, any>) => boolean;
}
export type Field =
  | (Base & { type: 'switch' })
  | (Base & { type: 'text' | 'password' | 'textarea' | 'url' })
  | (Base & { type: 'number'; min?: number; max?: number; step?: number })
  | (Base & { type: 'select'; options: Array<{ value: string | number; label: string }>; numeric?: boolean })
  | (Base & { type: 'multi'; options: string[] })
  | (Base & { type: 'lines' }); // a list of strings, one per line

export function SchemaFields({ fields }: { fields: Field[] }) {
  const { config, saved, set } = useSettings();
  return (
    <div className="flex flex-col gap-4">
      {fields
        .filter((f) => !f.when || f.when(config))
        .map((f) => {
          const value = getPath(config, f.path);
          const changed = JSON.stringify(value) !== JSON.stringify(getPath(saved, f.path));
          const label = changed ? `${t(f.label)} •` : t(f.label); // a dot marks unsaved changes
          const help = f.help ? t(f.help) : undefined;
          switch (f.type) {
            case 'switch':
              return <Switch key={f.path} label={label} help={help} checked={!!value} onChange={(v) => set(f.path, v)} />;
            case 'number':
              return <NumberField key={f.path} label={label} help={help} min={f.min} max={f.max} step={f.step} value={value as number} onChange={(v) => set(f.path, v ?? 0)} />;
            case 'select':
              return <Select key={f.path} label={label} help={help} value={String(value ?? '')} options={f.options.map((o) => ({ ...o, label: t(o.label) }))} onChange={(v) => set(f.path, f.numeric ? Number(v) : v)} />;
            case 'textarea':
              return <TextArea key={f.path} label={label} help={help} rows={6} value={String(value ?? '')} onChange={(v) => set(f.path, v)} className="font-mono" />;
            case 'multi':
              return (
                <fieldset key={f.path} className="flex flex-col gap-1">
                  <legend className={cx('mb-1 text-xs font-medium text-primary uppercase')}>{label}</legend>
                  <div className="flex flex-wrap gap-4">
                    {f.options.map((o) => {
                      const list = (value as string[]) ?? [];
                      return <Checkbox key={o} label={o} checked={list.includes(o)} onChange={(on) => set(f.path, on ? [...list, o] : list.filter((x) => x !== o))} />;
                    })}
                  </div>
                  {help && <p className="text-xs text-muted">{help}</p>}
                </fieldset>
              );
            case 'lines':
              return <TextArea key={f.path} label={label} help={help ?? t('One per line')} rows={3} value={((value as string[]) ?? []).join('\n')} onChange={(v) => set(f.path, v.split('\n').map((s) => s.trim()).filter(Boolean))} />;
            default:
              return <TextField key={f.path} label={label} help={help} type={f.type === 'password' ? 'password' : f.type === 'url' ? 'url' : 'text'} value={String(value ?? '')} onChange={(v) => set(f.path, v)} autoComplete="off" />;
          }
        })}
    </div>
  );
}
