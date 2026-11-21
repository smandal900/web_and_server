import { useEffect, useState } from 'react';
import { mdiCloudUploadOutline } from '@mdi/js';
import { t } from '../../i18n';
import { useUpload } from '../../state/UploadProvider';
import { Icon } from '../ui/Icon';

const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');

/** While files are dragged over the window, show a drop target; dropping adds them to the upload queue. */
export function DropOverlay({ albumId }: { albumId?: string }) {
  const { addFiles } = useUpload();
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let depth = 0; // dragenter/leave fire for every child element, so count them
    const enter = (e: DragEvent) => hasFiles(e) && (depth++, setDragging(true));
    const leave = (e: DragEvent) => hasFiles(e) && --depth <= 0 && ((depth = 0), setDragging(false));
    const over = (e: DragEvent) => hasFiles(e) && e.preventDefault();
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      addFiles(Array.from(e.dataTransfer?.files ?? []), { albumId });
    };
    const paste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length) addFiles(files, { albumId });
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    window.addEventListener('paste', paste);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
      window.removeEventListener('paste', paste);
    };
  }, [addFiles, albumId]);

  if (!dragging) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[9500] flex flex-col items-center justify-center gap-3 bg-primary/20 text-primary backdrop-blur-sm">
      <Icon path={mdiCloudUploadOutline} size={96} />
      <p className="text-xl font-semibold">{t('Drop files to upload')}</p>
    </div>
  );
}
