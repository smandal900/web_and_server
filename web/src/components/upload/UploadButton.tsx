import { useRef } from 'react';
import { mdiCloudUploadOutline } from '@mdi/js';
import { t } from '../../i18n';
import { useMediaTypes } from '../../hooks/useServer';
import { useUpload } from '../../state/UploadProvider';
import { Button } from '../ui/Button';

/** Opens the file picker (photos and videos the server accepts) and queues the chosen files. */
export function UploadButton({ albumId, compact }: { albumId?: string; compact?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const { addFiles } = useUpload();
  const types = useMediaTypes().data;
  const accept = types ? [...types.image, ...types.video].join(',') : 'image/*,video/*';

  return (
    <>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        accept={accept}
        onChange={(e) => {
          addFiles(Array.from(e.target.files ?? []), { albumId });
          e.target.value = ''; // allow choosing the same file again
        }}
      />
      <Button variant="ghost" icon={mdiCloudUploadOutline} onClick={() => input.current?.click()} aria-label={t('Upload')}>
        {!compact && <span className="max-md:hidden">{t('Upload')}</span>}
      </Button>
    </>
  );
}
