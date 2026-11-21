import { useState } from 'react';
import { mdiAlertCircle, mdiCheckCircle, mdiChevronDown, mdiChevronUp, mdiClose, mdiContentDuplicate, mdiRefresh } from '@mdi/js';
import { t } from '../../i18n';
import { formatBytes } from '../../lib/format';
import { useUpload, type UploadItem } from '../../state/UploadProvider';
import { IconButton } from '../ui/Button';
import { Icon } from '../ui/Icon';

const STATUS_TEXT: Record<UploadItem['status'], string> = {
  queued: 'Waiting',
  hashing: 'Reading file',
  checking: 'Checking for duplicates',
  uploading: 'Uploading',
  done: 'Uploaded',
  duplicate: 'Already in library',
  error: 'Failed',
  canceled: 'Cancelled',
};

function Row({ item }: { item: UploadItem }) {
  const { retry, cancel } = useUpload();
  const busy = ['queued', 'hashing', 'checking', 'uploading'].includes(item.status);
  return (
    <li className="flex items-center gap-3 px-4 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{item.file.name}</p>
        <p className="text-xs text-muted">
          {item.error ?? t(STATUS_TEXT[item.status])} · {formatBytes(item.file.size)}
        </p>
        {busy && (
          <div className="mt-1 h-1 overflow-hidden rounded bg-panel">
            <div className="h-full bg-primary transition-all" style={{ width: `${Math.round(item.progress * 100)}%` }} />
          </div>
        )}
      </div>
      {item.status === 'done' && <Icon path={mdiCheckCircle} className="text-success" />}
      {item.status === 'duplicate' && <Icon path={mdiContentDuplicate} className="text-warning" />}
      {item.status === 'error' && <Icon path={mdiAlertCircle} className="text-danger" />}
      {(item.status === 'error' || item.status === 'canceled') && <IconButton path={mdiRefresh} label="Retry" size={18} onClick={() => retry(item.id)} />}
      {busy && <IconButton path={mdiClose} label="Cancel" size={18} onClick={() => cancel(item.id)} />}
    </li>
  );
}

/** Bottom-right progress card. Lazy loaded the first time a file is added. */
export default function UploadPanel() {
  const { items, clearFinished, setPanelOpen } = useUpload();
  const [collapsed, setCollapsed] = useState(false);
  const finished = items.filter((i) => ['done', 'duplicate'].includes(i.status)).length;
  const running = items.some((i) => ['queued', 'hashing', 'checking', 'uploading'].includes(i.status));

  return (
    <div className="fixed right-4 bottom-4 z-[7000] w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-bg shadow-2xl">
      <div className="flex items-center gap-1 bg-panel px-4 py-2">
        <p className="flex-1 text-sm font-medium">
          {running ? t('Uploading') : t('Upload finished')} · {finished}/{items.length}
        </p>
        <IconButton path={collapsed ? mdiChevronUp : mdiChevronDown} label={collapsed ? 'Expand' : 'Collapse'} size={20} onClick={() => setCollapsed(!collapsed)} />
        <IconButton
          path={mdiClose}
          label="Close"
          size={20}
          onClick={() => {
            if (!running) clearFinished();
            setPanelOpen(false);
          }}
        />
      </div>
      {!collapsed && (
        <>
          <ul className="max-h-72 divide-y divide-line overflow-y-auto">
            {items.map((item) => (
              <Row key={item.id} item={item} />
            ))}
          </ul>
          {!running && items.length > 0 && (
            <button onClick={clearFinished} className="w-full border-t border-line py-2 text-sm text-primary hover:bg-panel">
              {t('Clear finished')}
            </button>
          )}
        </>
      )}
    </div>
  );
}
