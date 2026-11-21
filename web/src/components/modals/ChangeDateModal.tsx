import { useState } from 'react';
import { updateAssets } from '../../api/assets';
import { useRun } from '../../hooks/useRun';
import { t } from '../../i18n';
import { Button } from '../ui/Button';
import { DateField } from '../ui/Fields';
import { Modal } from '../ui/Modal';

const nowLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

/** Set the "taken on" date and time of the chosen pictures. */
export default function ChangeDateModal({ assetIds, current, onClose, onDone }: { assetIds: string[]; current?: string; onClose: () => void; onDone: () => void }) {
  const run = useRun();
  const [value, setValue] = useState((current ?? nowLocal()).slice(0, 16));

  const save = async () => {
    const result = await run(() => updateAssets(assetIds, { dateTimeOriginal: new Date(value).toISOString() }), {
      success: t('Date changed'),
      invalidate: [['timeline'], ['asset']],
    });
    if (result.ok) onDone();
  };

  return (
    <Modal
      title={t('Change date')}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button onClick={save} disabled={!value}>
            {t('Save')}
          </Button>
        </>
      }
    >
      <DateField label={t('Date and time')} withTime value={value} onChange={setValue} />
      {assetIds.length > 1 && <p className="mt-2 text-xs text-muted">{t('The same date is set on all {count} items.', { count: assetIds.length })}</p>}
    </Modal>
  );
}
