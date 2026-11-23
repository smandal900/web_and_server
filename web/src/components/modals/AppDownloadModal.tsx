import { lazy } from 'react';
import { useToast } from '../../state/ToastProvider';
import { t } from '../../i18n';
import { Boundary } from '../ui/Boundary';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { copyText } from '../../lib/clipboard';

const Qrcode = lazy(() => import('../ui/Qrcode'));

/** Shows this server's address as a QR code so a phone app can connect, plus an Obtainium import config. */
export default function AppDownloadModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const url = location.origin;
  const obtainium = JSON.stringify({ id: 'app.alextran.immich', url: 'https://github.com/immich-app/immich', author: 'immich-app', name: 'Immich', preferredApkIndex: 0 }, null, 2);
  const copy = (text: string) => copyText(text).then(() => toast.success(t('Copied to clipboard')));

  return (
    <Modal title={t('Download the app')} onClose={onClose} size="md">
      <p className="mb-4 text-sm text-muted">{t('Scan this code from the mobile app to enter the server address, or copy it.')}</p>
      <div className="flex flex-col items-center gap-3">
        <Boundary compact>
          <Qrcode value={url} />
        </Boundary>
        <code className="rounded-lg bg-panel px-3 py-1.5 text-sm">{url}</code>
        <Button variant="outline" size="sm" onClick={() => copy(url)}>
          {t('Copy server address')}
        </Button>
      </div>
      <h3 className="mt-6 mb-2 text-sm font-semibold text-primary">Obtainium</h3>
      <p className="mb-2 text-xs text-muted">{t('Android users can install updates with Obtainium using this configuration.')}</p>
      <pre className="max-h-40 overflow-auto rounded-lg bg-panel p-3 text-xs">{obtainium}</pre>
      <Button variant="outline" size="sm" className="mt-2" onClick={() => copy(obtainium)}>
        {t('Copy configuration')}
      </Button>
    </Modal>
  );
}
