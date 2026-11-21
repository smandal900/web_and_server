import { Timeline } from '../timeline/Timeline';
import type { PickMode } from '../timeline/SelectionBar';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../ui/Misc';
import { mdiImageMultipleOutline } from '@mdi/js';
import { t } from '../../i18n';

/** Choose pictures from the whole library. Clicking selects; the bar's button returns the chosen ids. */
export default function AssetPickerModal({ title, pick, onClose }: { title: string; pick: PickMode; onClose: () => void }) {
  return (
    <Modal title={title} size="xl" onClose={onClose}>
      <div className="h-[65vh]">
        <Timeline
          query={{ order: 'desc', visibility: 'timeline' }}
          base="/__picker"
          pick={{ label: pick.label, onPick: async (ids) => (await pick.onPick(ids), onClose()) }}
          empty={<EmptyState icon={mdiImageMultipleOutline} title={t('No photos to choose from')} />}
        />
      </div>
    </Modal>
  );
}
