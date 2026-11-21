import { lazy } from 'react';
import { mdiImageMultipleOutline } from '@mdi/js';
import { TimelinePage } from '../../components/timeline/TimelinePage';
import { Boundary } from '../../components/ui/Boundary';
import { EmptyState } from '../../components/ui/Misc';
import { UploadButton } from '../../components/upload/UploadButton';
import { usePreferences } from '../../hooks/usePreferences';
import { t } from '../../i18n';

const MemoryLane = lazy(() => import('./MemoryLane'));

/** The main page: every picture, newest first, with the memory lane on top. */
export default function Photos() {
  const { preferences } = usePreferences();
  return (
    <TimelinePage
      title={t('Photos')}
      base="/photos"
      query={{ order: 'desc', visibility: 'timeline', withStacked: true, withPartners: true }}
      banner={
        preferences.memories.enabled ? (
          <Boundary compact fallback={null}>
            <MemoryLane />
          </Boundary>
        ) : undefined
      }
      empty={
        <EmptyState icon={mdiImageMultipleOutline} title={t('Add your first photos')} text={t('Upload photos and videos, or drop them anywhere on this page.')}>
          <UploadButton />
        </EmptyState>
      }
    />
  );
}
