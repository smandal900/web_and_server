import { LANGUAGES, t } from '../../../i18n';
import { Select } from '../../../components/ui/Fields';
import { useLanguage } from '../../../state/I18nProvider';
import { useTheme, type ThemeChoice } from '../../../state/ThemeProvider';
import { usePreferences } from '../../../hooks/usePreferences';
import { Switch } from '../../../components/ui/Fields';

export default function AppSettings() {
  const { choice, setChoice } = useTheme();
  const { language, setLanguage } = useLanguage();
  const { preferences, update } = usePreferences();
  return (
    <div className="flex flex-col gap-4">
      <Select
        label={t('Theme')}
        value={choice}
        onChange={(v) => setChoice(v as ThemeChoice)}
        options={[
          { value: 'system', label: t('Follow system') },
          { value: 'light', label: t('Light') },
          { value: 'dark', label: t('Dark') },
        ]}
      />
      <Select label={t('Language')} value={language} onChange={setLanguage} options={LANGUAGES.map((l) => ({ value: l.code, label: l.name }))} />
      <Select
        label={t('Default album order')}
        value={preferences.albums.defaultAssetOrder}
        onChange={(v) => update({ albums: { defaultAssetOrder: v } })}
        options={[
          { value: 'desc', label: t('Newest first') },
          { value: 'asc', label: t('Oldest first') },
        ]}
      />
      <Switch label={t('Show "Recently added" in the sidebar')} checked={preferences.recentlyAdded.sidebarWeb} onChange={(v) => update({ recentlyAdded: { sidebarWeb: v } })} />
    </div>
  );
}
