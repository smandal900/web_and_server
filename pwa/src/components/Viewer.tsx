// Full-screen picture or video: swipe sideways for the next one, pinch or double tap to zoom (the web app's zoom),
// and a strip of the similar photos that share a tile.
import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  mdiArchiveArrowDownOutline,
  mdiArchiveArrowUpOutline,
  mdiArrowLeft,
  mdiDeleteForeverOutline,
  mdiDeleteOutline,
  mdiDeleteRestore,
  mdiDotsVertical,
  mdiDownload,
  mdiHeart,
  mdiHeartOutline,
  mdiImagePlusOutline,
  mdiInformationOutline,
  mdiShareVariantOutline,
} from '@mdi/js';
import { getAsset, originalUrl, saveFile, thumbnailUrl, videoUrl } from '@web/api/assets';
import { errorMessage } from '@web/api/client';
import type { TimelineAsset } from '@web/api/types';
import { useFeatures } from '@web/hooks/useServer';
import { useZoomPan } from '@web/hooks/useZoomPan';
import { formatBytes } from '@web/lib/format';
import { useToast } from '@web/state/ToastProvider';
import { AlbumPicker, useActions } from './actions';
import type { GalleryKind } from './Gallery';
import { Confirm, IconButton, Row, Sheet, Spinner } from './ui';

interface ViewerProps {
  kind: GalleryKind;
  id: string;
  /** The loaded pictures in grid order, for swiping. */
  assets: TimelineAsset[];
  group?: TimelineAsset[];
  onShow: (id: string) => void;
  onClose: () => void;
}

export default function Viewer({ kind, id, assets, group, onShow, onClose }: ViewerProps) {
  const actions = useActions();
  const toast = useToast();
  const trash = useFeatures().data?.trash !== false;
  const info = useQuery({ queryKey: ['asset', id], queryFn: () => getAsset(id), staleTime: 30_000 });
  const [bars, setBars] = useState(true);
  const [sheet, setSheet] = useState<'info' | 'more' | 'delete' | 'album' | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const swipe = useRef<{ x: number; y: number } | null>(null);

  const index = assets.findIndex((a) => a.id === id);
  const listed = assets[index];
  const asset = info.data;
  const isImage = asset ? asset.type !== 'VIDEO' : (listed?.isImage ?? true);
  const favorite = asset?.isFavorite ?? listed?.isFavorite ?? false;
  const forever = kind === 'bin' || !trash;

  /** After the current picture left this list: the next one, the previous one, or back to the grid. */
  const leave = () => {
    const other = assets[index + 1] ?? assets[index - 1];
    if (other) onShow(other.id);
    else onClose();
  };
  const move = async (change: Promise<boolean>) => (await change) && leave();

  const share = async () => {
    if (!asset) return;
    try {
      const response = await fetch(originalUrl(id));
      if (!response.ok) throw new Error('The file could not be loaded');
      const file = new File([await response.blob()], asset.originalFileName, { type: asset.originalMimeType });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
      else saveFile(originalUrl(id), asset.originalFileName);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') toast.error(errorMessage(error));
    }
  };

  const exif = asset?.exifInfo;

  return (
    <div className="fixed inset-0 z-40 bg-black text-white" role="dialog" aria-label={asset?.originalFileName ?? 'Photo'}>
      <div
        className="absolute inset-0"
        onTouchStart={(e) => {
          swipe.current = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
        }}
        onTouchEnd={(e) => {
          const from = swipe.current;
          swipe.current = null;
          if (!from || zoomed) return;
          const dx = e.changedTouches[0].clientX - from.x;
          const dy = e.changedTouches[0].clientY - from.y;
          if (dy > 120 && dy > Math.abs(dx) * 1.5) return onClose(); // swipe down closes
          if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
          const other = assets[index + (dx < 0 ? 1 : -1)];
          if (index >= 0 && other) onShow(other.id);
        }}
      >
        {isImage ? (
          <ZoomImage key={id} id={id} onZoom={setZoomed} onTap={() => setBars((b) => !b)} />
        ) : (
          <video key={id} src={videoUrl(id)} poster={thumbnailUrl(id, 'preview')} controls autoPlay playsInline className="size-full object-contain" />
        )}
      </div>

      {bars && (
        <div className="absolute inset-x-0 top-0 flex items-center bg-gradient-to-b from-black/70 to-transparent px-1 pt-[env(safe-area-inset-top)] pb-3">
          <IconButton path={mdiArrowLeft} label="Back" onClick={onClose} className="active:bg-white/20" />
          <span className="flex-1" />
          {kind === 'bin' ? (
            <IconButton path={mdiDeleteRestore} label="Restore" onClick={() => void move(actions.restore([id]))} />
          ) : (
            <>
              <IconButton path={favorite ? mdiHeart : mdiHeartOutline} label={favorite ? 'Remove from favorites' : 'Favorite'} onClick={() => void actions.favorite([id], !favorite)} />
              <IconButton path={mdiShareVariantOutline} label="Share" onClick={() => void share()} />
            </>
          )}
          <IconButton path={mdiInformationOutline} label="Info" onClick={() => setSheet('info')} />
          <IconButton path={forever ? mdiDeleteForeverOutline : mdiDeleteOutline} label="Delete" onClick={() => setSheet('delete')} />
          {kind !== 'bin' && <IconButton path={mdiDotsVertical} label="More" onClick={() => setSheet('more')} />}
        </div>
      )}

      {bars && group && (
        <div className="absolute inset-x-0 bottom-0 flex justify-center pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div role="group" aria-label="Similar photos" className="flex max-w-full gap-1 overflow-x-auto px-3 [scrollbar-width:none]">
            {group.map((member, i) => (
              <button
                key={member.id}
                type="button"
                aria-label={`Similar photo ${i + 1} of ${group.length}`}
                aria-current={member.id === id}
                onClick={() => onShow(member.id)}
                className={`size-14 shrink-0 overflow-hidden rounded-lg border-2 ${member.id === id ? 'border-white' : 'border-transparent opacity-60'}`}
              >
                <img src={thumbnailUrl(member.id)} alt="" className="size-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {sheet === 'info' && (
        <Sheet title="Details" onClose={() => setSheet(null)}>
          {!asset ? (
            <Spinner />
          ) : (
            <dl className="space-y-3 text-sm">
              <Detail label="Name" value={asset.originalFileName} />
              <Detail label="Taken" value={new Date(asset.localDateTime ?? asset.fileCreatedAt).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short', timeZone: 'UTC' })} />
              <Detail label="Size" value={[asset.width && `${asset.width} × ${asset.height}`, exif?.fileSizeInByte && formatBytes(exif.fileSizeInByte)].filter(Boolean).join(' · ')} />
              <Detail label="Camera" value={[exif?.make, exif?.model].filter(Boolean).join(' ')} />
              <Detail label="Place" value={[exif?.city, exif?.state, exif?.country].filter(Boolean).join(', ')} />
            </dl>
          )}
        </Sheet>
      )}
      {sheet === 'more' && (
        <Sheet title="More" onClose={() => setSheet(null)}>
          <Row icon={mdiImagePlusOutline} label="Add to album" onClick={() => setSheet('album')} />
          <Row
            icon={kind === 'archive' ? mdiArchiveArrowUpOutline : mdiArchiveArrowDownOutline}
            label={kind === 'archive' ? 'Unarchive' : 'Archive'}
            onClick={() => {
              setSheet(null);
              void move(actions.archive([id], kind !== 'archive'));
            }}
          />
          <Row
            icon={mdiDownload}
            label="Save to phone"
            onClick={() => {
              setSheet(null);
              saveFile(originalUrl(id), asset?.originalFileName ?? id);
            }}
          />
        </Sheet>
      )}
      {sheet === 'delete' && (
        <Confirm title="Delete this item?" text={forever ? 'It will be deleted for good.' : 'It will be moved to the bin.'} action="Delete" onYes={() => void move(actions.remove([id], forever))} onClose={() => setSheet(null)} />
      )}
      {sheet === 'album' && <AlbumPicker ids={[id]} onClose={() => setSheet(null)} />}
    </div>
  );
}

const Detail = ({ label, value }: { label: string; value: string }) =>
  value ? (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="break-all">{value}</dd>
    </div>
  ) : null;

/** The thumbnail shows at once; the larger preview covers it when it has arrived. */
function ZoomImage({ id, onZoom, onTap }: { id: string; onZoom: (zoomed: boolean) => void; onTap: () => void }) {
  const area = useRef<HTMLDivElement>(null);
  const zoom = useZoomPan(area);
  const [failed, setFailed] = useState(false);
  const last = useRef(zoom.zoomed);
  if (last.current !== zoom.zoomed) {
    last.current = zoom.zoomed;
    queueMicrotask(() => onZoom(zoom.zoomed));
  }
  return (
    <div ref={area} className="size-full touch-none overflow-hidden" onClick={onTap}>
      {failed ? (
        <p className="flex size-full items-center justify-center text-sm text-white/70">This picture cannot be shown.</p>
      ) : (
        <div className="relative size-full" style={zoom.style}>
          <img src={thumbnailUrl(id)} alt="" draggable={false} className="absolute inset-0 size-full object-contain" />
          <img src={thumbnailUrl(id, 'preview')} alt="" draggable={false} onError={() => setFailed(true)} className="absolute inset-0 size-full object-contain" />
        </div>
      )}
    </div>
  );
}
