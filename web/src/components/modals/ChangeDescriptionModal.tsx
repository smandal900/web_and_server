import { useState } from 'react';
import { updateAssets } from '../../api/assets';
import { useRun } from '../../hooks/useRun';
import { t } from '../../i18n';
import { Button } from '../ui/Button';
import { TextArea } from '../ui/Fields';
import { Modal } from '../ui/Modal';

export default function ChangeDescriptionModal({ assetIds, current = '', onClose, onDone }: { assetIds: string[]; current?: string; onClose: () => void; onDone: () => void }) {
  const run = useRun();
  const [text, setText] = useState(current);

  const save = async () => {
    const result = await run(() => updateAssets(assetIds, { description: text }), { success: t('Description saved'), invalidate: [['asset'], ['timeline']] });
    if (result.ok) onDone();
  };

  return (
    <Modal
      title={t('Change description')}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button onClick={save}>{t('Save')}</Button>
        </>
      }
    >
      <TextArea label={t('Description')} rows={4} value={text} onChange={setText} />
    </Modal>
  );
}
