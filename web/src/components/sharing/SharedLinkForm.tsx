import { Select, Switch, TextField } from '../ui/Fields';
import { t } from '../../i18n';
import type { SharedLinkInput } from '../../api/library';

/** When a link stops working, as choices in minutes (0 = never). */
export const EXPIRY_OPTIONS = [
  { value: '0', label: 'Never' },
  { value: '30', label: '30 minutes' },
  { value: '60', label: '1 hour' },
  { value: '360', label: '6 hours' },
  { value: '1440', label: '1 day' },
  { value: '10080', label: '7 days' },
  { value: '43200', label: '30 days' },
  { value: '129600', label: '3 months' },
  { value: '525600', label: '1 year' },
];

export interface LinkFormValue {
  description: string;
  password: string;
  slug: string;
  expiry: string; // minutes from now, or 'keep' when editing and leaving the date alone
  allowDownload: boolean;
  showMetadata: boolean;
  allowUpload: boolean;
}
export const defaultLinkForm: LinkFormValue = { description: '', password: '', slug: '', expiry: '0', allowDownload: true, showMetadata: true, allowUpload: false };

/** Convert the form to the request body. */
export function linkFormToInput(form: LinkFormValue): SharedLinkInput {
  const input: SharedLinkInput = {
    description: form.description || null,
    password: form.password || null,
    slug: form.slug || null,
    allowDownload: form.allowDownload,
    showMetadata: form.showMetadata,
    allowUpload: form.allowUpload,
  };
  if (form.expiry !== 'keep') input.expiresAt = form.expiry === '0' ? null : new Date(Date.now() + Number(form.expiry) * 60_000).toISOString();
  return input;
}

/** The options of a shared link; used when creating and when editing. */
export function SharedLinkForm({ value, onChange, editing }: { value: LinkFormValue; onChange: (v: LinkFormValue) => void; editing?: boolean }) {
  const set = <K extends keyof LinkFormValue>(key: K) => (v: LinkFormValue[K]) => onChange({ ...value, [key]: v });
  const expiry = editing ? [{ value: 'keep', label: 'Keep current' }, ...EXPIRY_OPTIONS] : EXPIRY_OPTIONS;
  return (
    <div className="flex flex-col gap-3">
      <TextField label={t('Description')} value={value.description} onChange={set('description')} />
      <TextField label={t('Password')} type="password" help={t('Leave empty for no password')} value={value.password} onChange={set('password')} autoComplete="new-password" />
      <TextField label={t('Custom link name')} help={t('Optional short name used in the link address')} value={value.slug} onChange={set('slug')} />
      <Select label={t('Expires after')} value={value.expiry} onChange={set('expiry')} options={expiry.map((o) => ({ ...o, label: t(o.label) }))} />
      <Switch label={t('Show metadata')} checked={value.showMetadata} onChange={set('showMetadata')} />
      <Switch label={t('Allow downloads')} checked={value.allowDownload} onChange={set('allowDownload')} />
      <Switch label={t('Allow public users to upload')} checked={value.allowUpload} onChange={set('allowUpload')} />
    </div>
  );
}
