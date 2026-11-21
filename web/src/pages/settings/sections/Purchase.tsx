import { Link } from 'react-router';
import { Button } from '../../../components/ui/Button';
import { Switch } from '../../../components/ui/Fields';
import { usePreferences } from '../../../hooks/usePreferences';
import { t } from '../../../i18n';

/** Supporter badge options. This server is self-hosted, so there is nothing to buy; the page explains that. */
export default function Purchase() {
  const { preferences, update } = usePreferences();
  return (
    <div className="flex flex-col items-start gap-3">
      <Switch label={t('Show supporter badge')} checked={preferences.purchase.showSupportBadge} onChange={(v) => update({ purchase: { showSupportBadge: v } })} />
      <Link to="/buy">
        <Button variant="outline">{t('About supporting')}</Button>
      </Link>
    </div>
  );
}
