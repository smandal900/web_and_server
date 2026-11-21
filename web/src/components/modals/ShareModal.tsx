import { lazy, useState } from 'react';
import { createSharedLink, shareLinkUrl } from '../../api/library';
import type { SharedLink } from '../../api/types';
import { useRun } from '../../hooks/useRun';
import { t } from '../../i18n';
import { useToast } from '../../state/ToastProvider';
import { defaultLinkForm, linkFormToInput, SharedLinkForm, type LinkFormValue } from '../sharing/SharedLinkForm';
import { Boundary } from '../ui/Boundary';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

const Qrcode = lazy(() => import('../ui/Qrcode'));

/** Create a public link for some pictures (or a whole album), then show it with a copy button and QR code. */
export default function ShareModal({ assetIds, albumId, onClose }: { assetIds?: string[]; albumId?: string; onClose: () => void }) {
  const run = useRun();
  const toast = useToast();
  const [form, setForm] = useState<LinkFormValue>(defaultLinkForm);
  const [link, setLink] = useState<SharedLink>();
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    const result = await run(
      () => createSharedLink({ ...linkFormToInput(form), type: albumId ? 'ALBUM' : 'INDIVIDUAL', albumId, assetIds }),
      { invalidate: [['shared-links'], ['albums'], ['album']] },
    );
    setBusy(false);
    if (result.ok) setLink(result.data);
  };

  if (link) {
    const url = shareLinkUrl(link);
    return (
      <Modal title={t('Your link is ready')} onClose={onClose} size="sm" footer={<Button onClick={onClose}>{t('Done')}</Button>}>
        <div className="flex flex-col items-center gap-3">
          <Boundary compact>
            <Qrcode value={url} />
          </Boundary>
          <code className="w-full rounded-lg bg-panel p-2 text-center text-xs break-all">{url}</code>
          <Button variant="outline" onClick={() => navigator.clipboard.writeText(url).then(() => toast.success(t('Copied to clipboard')))}>
            {t('Copy link')}
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={t('Share with a link')}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button loading={busy} onClick={create}>
            {t('Create link')}
          </Button>
        </>
      }
    >
      <SharedLinkForm value={form} onChange={setForm} />
    </Modal>
  );
}
