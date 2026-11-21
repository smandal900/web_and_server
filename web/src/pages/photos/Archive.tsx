import { mdiArchiveArrowDownOutline } from '@mdi/js';
import { ARCHIVE_ACTIONS } from '../../components/timeline/presets';
import { TimelinePage } from '../../components/timeline/TimelinePage';
import { EmptyState } from '../../components/ui/Misc';
import { t } from '../../i18n';

/** Pictures hidden from the main timeline but kept. */
export default function Archive() {
  return (
    <TimelinePage
      title={t('Archive')}
      base="/archive"
      query={{ visibility: 'archive', order: 'desc' }}
      actions={ARCHIVE_ACTIONS}
      empty={<EmptyState icon={mdiArchiveArrowDownOutline} title={t('Nothing archived')} text={t('Archive photos to keep them out of the main timeline.')} />}
    />
  );
}
