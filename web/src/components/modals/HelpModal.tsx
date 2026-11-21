import { useAbout } from '../../hooks/useServer';
import { t } from '../../i18n';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

/** "Help & feedback": copies the details an admin needs to diagnose a problem. */
export default function HelpModal({ onClose }: { onClose: () => void }) {
  const about = useAbout().data;
  const details = [`Server: ${about?.version ?? 'unknown'}`, `Browser: ${navigator.userAgent}`, `Page: ${location.pathname}`].join('\n');
  return (
    <Modal title={t('Help & feedback')} onClose={onClose} size="md" footer={<Button onClick={() => navigator.clipboard.writeText(details)}>{t('Copy diagnostic details')}</Button>}>
      <p className="mb-3 text-sm text-muted">{t('If something does not work, send these details to your server administrator.')}</p>
      <pre className="rounded-lg bg-panel p-3 text-xs break-all whitespace-pre-wrap">{details}</pre>
    </Modal>
  );
}
