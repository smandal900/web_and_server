import { useAbout, useVersion } from '../../hooks/useServer';
import { t } from '../../i18n';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/Spinner';

export default function AboutModal({ onClose }: { onClose: () => void }) {
  const about = useAbout();
  const version = useVersion().data;
  const rows: Array<[string, string | undefined]> = [
    [t('Server version'), about.data?.version],
    [t('Feature level'), version ? `${version.major}.${version.minor}.${version.patch}` : undefined],
    ['Node.js', about.data?.nodejs],
    [t('Web client'), `React ${import.meta.env.MODE}`],
  ];
  return (
    <Modal title={t('About this server')} onClose={onClose} size="sm">
      {about.isLoading ? (
        <Spinner />
      ) : (
        <dl className="divide-y divide-line text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between py-2">
              <dt className="text-muted">{label}</dt>
              <dd className="font-mono">{value ?? '-'}</dd>
            </div>
          ))}
        </dl>
      )}
    </Modal>
  );
}
