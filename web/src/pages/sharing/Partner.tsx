import { useParams } from 'react-router';
import { mdiAccountOutline } from '@mdi/js';
import { READONLY_ACTIONS } from '../../components/timeline/presets';
import { TimelinePage } from '../../components/timeline/TimelinePage';
import { EmptyState } from '../../components/ui/Misc';
import { t } from '../../i18n';

/** A partner's library, read only. */
export default function Partner() {
  const { userId = '' } = useParams();
  return (
    <TimelinePage
      title={t('Partner photos')}
      base={`/partners/${userId}`}
      query={{ userId, order: 'desc', visibility: 'timeline' }}
      actions={READONLY_ACTIONS}
      readOnly
      empty={<EmptyState icon={mdiAccountOutline} title={t('Nothing shared yet')} />}
    />
  );
}
