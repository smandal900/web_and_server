import { mdiLockOutline } from '@mdi/js';
import { RequireUnlocked } from '../../components/layout/Guards';
import { LOCKED_ACTIONS } from '../../components/timeline/presets';
import { TimelinePage } from '../../components/timeline/TimelinePage';
import { EmptyState } from '../../components/ui/Misc';
import { t } from '../../i18n';

/** Private pictures. The PIN prompt comes first (RequireUnlocked). */
export default function Locked() {
  return (
    <RequireUnlocked>
      <TimelinePage
        title={t('Locked folder')}
        base="/locked"
        query={{ visibility: 'locked', order: 'desc' }}
        actions={LOCKED_ACTIONS}
        empty={<EmptyState icon={mdiLockOutline} title={t('The locked folder is empty')} text={t('Move photos here from the photo menu to hide them behind your PIN.')} />}
      />
    </RequireUnlocked>
  );
}
