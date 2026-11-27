import { lazy, useState } from 'react';
import { mdiImageMultipleOutline } from '@mdi/js';
import { TimelinePage } from '../../components/timeline/TimelinePage';
import { Boundary } from '../../components/ui/Boundary';
import { IconButton } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/Misc';
import { UploadButton } from '../../components/upload/UploadButton';
import { usePreferences } from '../../hooks/usePreferences';
import { t } from '../../i18n';

const MemoryLane = lazy(() => import('./MemoryLane'));

const SIMILAR_KEY = 'photos-group-similar';
/** On unless the viewer switched it off on this device. */
const similarPref = () => {
  try {
    return localStorage.getItem(SIMILAR_KEY) !== '0';
  } catch {
    return true;
  }
};

/** The main page: every picture, newest first, with the memory lane on top. */
export default function Photos() {
  const { preferences } = usePreferences();
  const [similar, setSimilar] = useState(similarPref);
  const toggleSimilar = () => {
    setSimilar(!similar);
    try {
      localStorage.setItem(SIMILAR_KEY, similar ? '0' : '1');
    } catch {
      /* the choice then lasts until the page is left */
    }
  };
  return (
    <TimelinePage
      title={t('Photos')}
      headerActions={<IconButton path={mdiImageMultipleOutline} label={t('Group similar photos')} active={similar} aria-pressed={similar} onClick={toggleSimilar} />}
      similar={similar}
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
