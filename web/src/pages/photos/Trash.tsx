import { useState } from 'react';
import { mdiDeleteOutline, mdiDeleteSweepOutline, mdiRestore } from '@mdi/js';
import { emptyTrash, restoreAllTrash } from '../../api/assets';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/Misc';
import { TRASH_ACTIONS } from '../../components/timeline/presets';
import { TimelinePage } from '../../components/timeline/TimelinePage';
import { useRun } from '../../hooks/useRun';
import { useServerConfig } from '../../hooks/useServer';
import { t } from '../../i18n';

const REFRESH = [['timeline'], ['asset-statistics']];

export default function Trash() {
  const run = useRun();
  const days = useServerConfig().data?.trashDays ?? 30;
  const [confirm, setConfirm] = useState(false);

  return (
    <>
      <TimelinePage
        title={t('Trash')}
        base="/trash"
        query={{ isTrashed: true, order: 'desc' }}
        actions={TRASH_ACTIONS}
        banner={<p className="bg-panel-2 px-4 py-2 text-sm text-muted">{t('Items in the trash are deleted for good after {days} days.', { days })}</p>}
        headerActions={
          <>
            <Button variant="ghost" icon={mdiRestore} onClick={() => run(() => restoreAllTrash(), { success: t('Everything restored'), invalidate: REFRESH })}>
              <span className="max-md:hidden">{t('Restore all')}</span>
            </Button>
            <Button variant="danger-outline" icon={mdiDeleteSweepOutline} onClick={() => setConfirm(true)}>
              <span className="max-md:hidden">{t('Empty trash')}</span>
            </Button>
          </>
        }
        empty={<EmptyState icon={mdiDeleteOutline} title={t('Trash is empty')} text={t('Deleted photos and videos wait here before they are removed.')} />}
      />
      {confirm && (
        <ConfirmDialog
          title={t('Empty the trash?')}
          message={t('Everything in the trash will be deleted permanently. This cannot be undone.')}
          confirmText="Empty trash"
          danger
          onClose={() => setConfirm(false)}
          onConfirm={() => run(() => emptyTrash(), { success: t('Trash emptied'), invalidate: REFRESH })}
        />
      )}
    </>
  );
}
