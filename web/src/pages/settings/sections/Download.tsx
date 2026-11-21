import { NumberField, Switch } from '../../../components/ui/Fields';
import { usePreferences } from '../../../hooks/usePreferences';
import { t } from '../../../i18n';

const GIB = 1024 ** 3;

export default function Download() {
  const { preferences, update } = usePreferences();
  const { archiveSize, includeEmbeddedVideos } = preferences.download;
  return (
    <div className="flex flex-col gap-4">
      <NumberField
        label={t('Archive size (GiB)')}
        help={t('Downloads of many files are split into zip files of at most this size.')}
        min={0.1}
        step={0.1}
        value={Number((archiveSize / GIB).toFixed(2))}
        onChange={(v) => update({ download: { archiveSize: Math.round((v ?? 4) * GIB) } })}
      />
      <Switch label={t('Include embedded videos')} help={t('Motion photos are downloaded with their video part')} checked={includeEmbeddedVideos} onChange={(v) => update({ download: { includeEmbeddedVideos: v } })} />
    </div>
  );
}
