import { mdiClockOutline } from '@mdi/js';
import { TimelinePage } from '../../components/timeline/TimelinePage';
import { EmptyState } from '../../components/ui/Misc';
import { t } from '../../i18n';

/** The newest uploads first (by upload date when the server supports it). */
export default function RecentlyAdded() {
  return (
    <TimelinePage
      title={t('Recently added')}
      base="/recently-added"
      query={{ order: 'desc', sortBy: 'createdAt', visibility: 'timeline' }}
      empty={<EmptyState icon={mdiClockOutline} title={t('Nothing here yet')} />}
    />
  );
}
