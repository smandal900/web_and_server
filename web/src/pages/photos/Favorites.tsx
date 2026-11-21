import { mdiHeartOutline } from '@mdi/js';
import { TimelinePage } from '../../components/timeline/TimelinePage';
import { EmptyState } from '../../components/ui/Misc';
import { t } from '../../i18n';

export default function Favorites() {
  return (
    <TimelinePage
      title={t('Favorites')}
      base="/favorites"
      query={{ isFavorite: true, order: 'desc' }}
      empty={<EmptyState icon={mdiHeartOutline} title={t('No favorites yet')} text={t('Mark photos with the heart to find them here.')} />}
    />
  );
}
