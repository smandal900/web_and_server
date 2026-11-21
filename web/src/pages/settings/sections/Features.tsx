import { NumberField, Switch } from '../../../components/ui/Fields';
import { usePreferences } from '../../../hooks/usePreferences';
import { t } from '../../../i18n';

/** Turn features on and off, and choose which of them also get a sidebar link. */
export default function Features() {
  const { preferences: p, update } = usePreferences();
  return (
    <div className="flex flex-col divide-y divide-line">
      <div className="pb-3">
        <Switch label={t('Memories')} checked={p.memories.enabled} onChange={(enabled) => update({ memories: { enabled } })} />
        {p.memories.enabled && (
          <div className="mt-2 flex flex-col gap-2 pl-4">
            <Switch label={t('Show in the sidebar')} checked={!!p.memories.sidebarWeb} onChange={(sidebarWeb) => update({ memories: { sidebarWeb } })} />
            <NumberField label={t('Seconds per picture')} min={1} max={60} value={p.memories.duration} onChange={(duration) => update({ memories: { duration: duration ?? 5 } })} />
          </div>
        )}
      </div>
      <div className="py-3">
        <Switch label={t('People')} checked={p.people.enabled} onChange={(enabled) => update({ people: { enabled } })} />
        {p.people.enabled && <Switch label={t('Show in the sidebar')} checked={p.people.sidebarWeb} onChange={(sidebarWeb) => update({ people: { sidebarWeb } })} />}
      </div>
      <div className="py-3">
        <Switch label={t('Folders')} checked={p.folders.enabled} onChange={(enabled) => update({ folders: { enabled } })} />
        {p.folders.enabled && <Switch label={t('Show in the sidebar')} checked={p.folders.sidebarWeb} onChange={(sidebarWeb) => update({ folders: { sidebarWeb } })} />}
      </div>
      <div className="py-3">
        <Switch label={t('Tags')} checked={p.tags.enabled} onChange={(enabled) => update({ tags: { enabled } })} />
        {p.tags.enabled && <Switch label={t('Show in the sidebar')} checked={p.tags.sidebarWeb} onChange={(sidebarWeb) => update({ tags: { sidebarWeb } })} />}
      </div>
      <div className="py-3">
        <Switch label={t('Shared links')} checked={p.sharedLinks.enabled} onChange={(enabled) => update({ sharedLinks: { enabled } })} />
        {p.sharedLinks.enabled && <Switch label={t('Show in the sidebar')} checked={p.sharedLinks.sidebarWeb} onChange={(sidebarWeb) => update({ sharedLinks: { sidebarWeb } })} />}
      </div>
      <div className="py-3">
        <Switch label={t('Ratings')} help={t('Star ratings in the photo details')} checked={p.ratings.enabled} onChange={(enabled) => update({ ratings: { enabled } })} />
      </div>
      <div className="pt-3">
        <Switch label={t('Cast to Chromecast')} checked={p.cast.gCastEnabled} onChange={(gCastEnabled) => update({ cast: { gCastEnabled } })} />
      </div>
    </div>
  );
}
