// Choosing files, and the progress card. The uploading itself (checksum, duplicate check, chunks) is the web app's.
import { useRef, type ReactNode } from 'react';
import { useMediaTypes } from '@web/hooks/useServer';
import { useUpload } from '@web/state/UploadProvider';

export function UploadButton({ children, className = 'flex size-11 items-center justify-center rounded-full active:bg-panel' }: { children: ReactNode; className?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const { addFiles } = useUpload();
  const types = useMediaTypes().data;
  return (
    <>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        accept={types ? [...types.image, ...types.video].join(',') : 'image/*,video/*'}
        onChange={(e) => {
          addFiles(Array.from(e.target.files ?? []));
          e.target.value = ''; // allow choosing the same file again
        }}
      />
      <button type="button" aria-label="Upload" className={className} onClick={() => input.current?.click()}>
        {children}
      </button>
    </>
  );
}

export function UploadStatus() {
  const { items, panelOpen, setPanelOpen, clearFinished, retry } = useUpload();
  if (!panelOpen || items.length === 0) return null;
  const finished = items.filter((i) => i.status === 'done' || i.status === 'duplicate').length;
  const failed = items.filter((i) => i.status === 'error');
  const running = items.some((i) => ['queued', 'hashing', 'checking', 'uploading'].includes(i.status));
  const progress = items.reduce((sum, i) => sum + (i.status === 'done' || i.status === 'duplicate' ? 1 : i.progress), 0) / items.length;
  return (
    <div role="status" className="fixed inset-x-3 bottom-24 z-30 rounded-2xl bg-panel p-4 text-sm shadow-xl">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium">
          {running ? `Uploading ${finished + 1} of ${items.length}` : `${finished} uploaded${failed.length ? `, ${failed.length} failed` : ''}`}
        </span>
        <span className="flex gap-3 text-primary">
          {failed.length > 0 && (
            <button type="button" onClick={() => failed.forEach((i) => retry(i.id))}>
              Retry
            </button>
          )}
          {!running && (
            <button
              type="button"
              onClick={() => {
                clearFinished();
                setPanelOpen(false);
              }}
            >
              Done
            </button>
          )}
        </span>
      </div>
      {running && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
          <div className="h-full bg-primary transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
      {failed[0]?.error && <p className="mt-2 text-xs text-danger">{failed[0].error}</p>}
    </div>
  );
}
