import { Switch } from '../../../components/ui/Fields';
import { useFeatures } from '../../../hooks/useServer';
import { usePreferences } from '../../../hooks/usePreferences';
import { t } from '../../../i18n';

export default function Notifications() {
  const { preferences, update } = usePreferences();
  const emailAvailable = useFeatures().data?.email;
  const n = preferences.emailNotifications;
  return (
    <div className="flex flex-col gap-2">
      {!emailAvailable && <p className="rounded-xl bg-warning/10 p-3 text-sm">{t('Email is not set up on the server, so no emails are sent yet.')}</p>}
      <Switch label={t('Email notifications')} checked={n.enabled} onChange={(enabled) => update({ emailNotifications: { enabled } })} />
      <Switch label={t('When I am added to an album')} checked={n.albumInvite} disabled={!n.enabled} onChange={(albumInvite) => update({ emailNotifications: { albumInvite } })} />
      <Switch label={t('When an album I am in gets new photos')} checked={n.albumUpdate} disabled={!n.enabled} onChange={(albumUpdate) => update({ emailNotifications: { albumUpdate } })} />
    </div>
  );
}
