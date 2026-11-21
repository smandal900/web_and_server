import { useState } from 'react';
import { mdiPlay } from '@mdi/js';
import { t } from '../../i18n';
import { loadSlideshowSettings, saveSlideshowSettings, type SlideshowSettings } from '../../lib/slideshow';
import { Button } from '../ui/Button';
import { NumberField, Select, Switch } from '../ui/Fields';
import { Modal } from '../ui/Modal';

export default function SlideshowSettingsModal({ onStart, onClose }: { onStart: (s: SlideshowSettings) => void; onClose: () => void }) {
  const [settings, setSettings] = useState(loadSlideshowSettings);
  const set = <K extends keyof SlideshowSettings>(key: K) => (value: SlideshowSettings[K]) => setSettings((s) => ({ ...s, [key]: value }));
  return (
    <Modal
      title={t('Slideshow')}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button
            icon={mdiPlay}
            onClick={() => {
              saveSlideshowSettings(settings);
              onStart(settings);
            }}
          >
            {t('Start')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <NumberField label={t('Seconds per picture')} min={1} max={60} value={settings.delay} onChange={(v) => set('delay')(v ?? 5)} />
        <Select
          label={t('Order')}
          value={settings.order}
          onChange={(v) => set('order')(v as SlideshowSettings['order'])}
          options={[
            { value: 'asc', label: t('Oldest first') },
            { value: 'desc', label: t('Newest first') },
            { value: 'shuffle', label: t('Shuffle') },
          ]}
        />
        <Switch label={t('Repeat')} checked={settings.loop} onChange={set('loop')} />
        <Switch label={t('Show details')} help={t('Date, description and place over the picture')} checked={settings.showMetadata} onChange={set('showMetadata')} />
      </div>
    </Modal>
  );
}
