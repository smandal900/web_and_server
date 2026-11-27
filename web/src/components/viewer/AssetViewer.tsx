import { lazy, useCallback, useEffect, useMemo, useState } from 'react';
import {
  mdiChevronLeft,
  mdiChevronRight,
  mdiCastConnected,
  mdiClose,
  mdiCommentTextOutline,
  mdiContentCopy,
  mdiDotsVertical,
  mdiFaceRecognition,
  mdiImageEditOutline,
  mdiImageSizeSelectActual,
  mdiInformationOutline,
  mdiPause,
  mdiPlay,
  mdiPlayBoxMultipleOutline,
  mdiStop,
  mdiTextRecognition,
} from '@mdi/js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getAsset, originalUrl, thumbnailUrl } from '../../api/assets';
import { updateAlbum } from '../../api/library';
import type { Asset } from '../../api/types';
import { useAssetActions, type ActionContext, type ActionId } from '../../hooks/useAssetActions';
import { usePreferences } from '../../hooks/usePreferences';
import { useRun } from '../../hooks/useRun';
import { useShortcut } from '../../hooks/useShortcuts';
import { t } from '../../i18n';
import { castMedia } from '../../lib/cast';
import { cx } from '../../lib/cx';
import { formatDate } from '../../lib/format';
import { slideshowOrder, type SlideshowSettings } from '../../lib/slideshow';
import { useAuth } from '../../state/AuthProvider';
import { useToast } from '../../state/ToastProvider';
import { fromAsset } from '../timeline/gridAsset';
import { Boundary } from '../ui/Boundary';
import { IconButton } from '../ui/Button';
import { Menu, type MenuItem } from '../ui/Menu';
import { PageSpinner } from '../ui/Spinner';
import { FaceOverlay, OcrOverlay } from './Overlays';
import { PhotoView } from './PhotoView';
import { VideoView } from './VideoView';
import { copyText } from '../../lib/clipboard';

// Everything that is not needed for a plain "look at one picture" is a separate chunk.
const DetailPanel = lazy(() => import('./DetailPanel'));
const ActivityPanel = lazy(() => import('./ActivityPanel'));
const PanoramaView = lazy(() => import('./PanoramaView'));
const PhotoEditor = lazy(() => import('./PhotoEditor'));
const FaceEditor = lazy(() => import('./FaceEditor'));
const SlideshowSettingsModal = lazy(() => import('../modals/SlideshowSettingsModal'));

export interface ViewerProps {
  assetId: string;
  /** Ids in display order, for previous/next. May be partial while a timeline is still loading. */
  assetIds: string[];
  /** The similar photos that share a tile with the current one: shown as a strip to switch between them. */
  similarIds?: string[];
  onShow: (id: string) => void;
  onClose: () => void;
  onAssetLoaded?: (asset: Asset) => void;
  /** Called when the user reaches the end of the loaded list. */
  onNeedMore?: () => void;
  actions?: ActionId[];
  context?: ActionContext;
  albumId?: string;
  shareKey?: string;
  readOnly?: boolean;
}

const LEAVE_AFTER: ActionId[] = ['trash', 'deletePermanent', 'restore', 'removeFromAlbum', 'removeFromSharedLink'];
const INLINE: ActionId[] = ['favorite', 'addToAlbum', 'share', 'download'];
const infoPref = () => {
  try {
    return localStorage.getItem('viewer-info') === '1';
  } catch {
    return false;
  }
};

export default function AssetViewer({ assetId, assetIds, similarIds, onShow, onClose, onAssetLoaded, onNeedMore, actions: allowed = [], context = {}, albumId, shareKey, readOnly }: ViewerProps) {
  const { user } = useAuth();
  const { preferences } = usePreferences();
  const qc = useQueryClient();
  const run = useRun();
  const toast = useToast();

  const query = useQuery({ queryKey: ['asset', assetId, shareKey], queryFn: () => getAsset(assetId, shareKey), staleTime: 30_000 });
  const asset = query.data;
  useEffect(() => {
    if (asset) onAssetLoaded?.(asset);
  }, [asset, onAssetLoaded]);

  const [panel, setPanel] = useState<'info' | 'activity' | null>(() => (infoPref() ? 'info' : null));
  const [mode, setMode] = useState<'view' | 'edit' | 'faces'>('view');
  const [showText, setShowText] = useState(false);
  const [slideshowDialog, setSlideshowDialog] = useState(false);
  const [slideshow, setSlideshow] = useState<{ order: string[]; settings: SlideshowSettings; paused: boolean } | null>(null);
  const isOwner = !readOnly && !!asset && asset.ownerId === user?.id;

  // --- navigation ---
  const index = assetIds.indexOf(assetId);
  const prevId = index > 0 ? assetIds[index - 1] : undefined;
  const nextId = index >= 0 && index < assetIds.length - 1 ? assetIds[index + 1] : undefined;
  useEffect(() => {
    if (index >= 0 && index >= assetIds.length - 3) onNeedMore?.(); // near the end: load the next month already
  }, [index, assetIds.length, onNeedMore]);

  // Warm the cache for the NEXT picture only (not both neighbours) and only once this one has been on screen for a moment.
  // Each preview may be generated on demand by the server, which costs memory there.
  useEffect(() => {
    if (!nextId || !asset) return;
    const timer = setTimeout(() => {
      new Image().src = `/api/assets/${nextId}/thumbnail?size=preview${shareKey ? `&key=${shareKey}` : ''}`;
    }, 600);
    return () => clearTimeout(timer);
  }, [nextId, shareKey, asset]);

  const togglePanel = (name: 'info' | 'activity') =>
    setPanel((p) => {
      const next = p === name ? null : name;
      if (name === 'info') {
        try {
          localStorage.setItem('viewer-info', next ? '1' : '0');
        } catch {
          /* ignore */
        }
      }
      return next;
    });

  // --- actions on this one asset ---
  const grid = useMemo(() => (asset ? [fromAsset(asset)] : []), [asset]);
  const leave = useCallback(() => (nextId ? onShow(nextId) : prevId ? onShow(prevId) : onClose()), [nextId, prevId, onShow, onClose]);
  const { actions, dialogs } = useAssetActions(grid, context, (id) => {
    if (LEAVE_AFTER.includes(id)) leave();
    else qc.invalidateQueries({ queryKey: ['asset', assetId] });
  });

  // --- slideshow ---
  useEffect(() => {
    if (!slideshow || slideshow.paused || mode !== 'view') return;
    const timer = setTimeout(() => {
      const at = slideshow.order.indexOf(assetId);
      const next = slideshow.order[at + 1] ?? (slideshow.settings.loop ? slideshow.order[0] : undefined);
      if (next) onShow(next);
      else setSlideshow(null);
    }, slideshow.settings.delay * 1000);
    return () => clearTimeout(timer);
  }, [slideshow, assetId, mode, onShow]);

  const startSlideshow = (settings: SlideshowSettings) => {
    setSlideshowDialog(false);
    setPanel(null);
    setSlideshow({ order: slideshowOrder(assetIds, assetId, settings.order), settings, paused: false });
    document.documentElement.requestFullscreen?.().catch(() => undefined);
  };
  const stopSlideshow = useCallback(() => {
    setSlideshow(null);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
  }, []);

  // --- keyboard ---
  const idle = mode === 'view';
  useShortcut('ArrowLeft', () => prevId && onShow(prevId), { enabled: idle });
  useShortcut('ArrowRight', () => nextId && onShow(nextId), { enabled: idle });
  useShortcut('Escape', () => (mode !== 'view' ? setMode('view') : slideshow ? stopSlideshow() : onClose()));
  useShortcut('i', () => togglePanel('info'), { enabled: idle });
  useShortcut('s', () => setSlideshowDialog(true), { enabled: idle && !slideshow });
  useShortcut('f', () => allowed.includes('favorite') && actions.favorite.run(), { enabled: idle && isOwner });
  useShortcut('Delete', () => (allowed.includes('trash') ? actions.trash.run() : allowed.includes('deletePermanent') && actions.deletePermanent.run()), { enabled: idle && isOwner });
  useShortcut('a', () => allowed.includes('archive') && actions.archive.run(), { enabled: idle && isOwner, modifier: 'shift' });

  if (query.isError) {
    return (
      <div className="fixed inset-0 z-[7500] flex flex-col items-center justify-center gap-4 bg-black text-white">
        <p>{(query.error as Error).message}</p>
        <IconButton path={mdiClose} label={t('Close')} onClick={onClose} />
      </div>
    );
  }
  if (!asset) {
    return (
      <div className="fixed inset-0 z-[7500] bg-black">
        <PageSpinner />
      </div>
    );
  }

  const isVideo = asset.type === 'VIDEO';
  const isPanorama = !isVideo && asset.exifInfo?.projectionType === 'EQUIRECTANGULAR';
  const canEdit = isOwner && !isVideo && !isPanorama;
  const showBar = !slideshow;
  const inline = INLINE.filter((id) => allowed.includes(id) && (isOwner || id === 'download'));
  const restore = (['restore', 'deletePermanent', 'trash'] as ActionId[]).filter((id) => allowed.includes(id) && isOwner);
  const extra = allowed.filter((id) => !INLINE.includes(id) && !restore.includes(id) && id !== 'linkLivePhoto' && id !== 'stack' && isOwner);

  const menu: MenuItem[] = [
    ...extra.map((id) => ({ label: actions[id].label, icon: actions[id].icon, onClick: actions[id].run, danger: actions[id].danger })),
    { label: t('Edit picture'), icon: mdiImageEditOutline, onClick: () => setMode('edit'), hidden: !canEdit, divider: true },
    { label: t('Tag a person'), icon: mdiFaceRecognition, onClick: () => setMode('faces'), hidden: !isOwner || isVideo },
    { label: t('Use as album cover'), icon: mdiImageSizeSelectActual, onClick: () => run(() => updateAlbum(albumId!, { albumThumbnailAssetId: asset.id }), { success: t('Album cover changed'), invalidate: [['album'], ['albums']] }), hidden: !albumId || !isOwner },
    { label: t('Copy link'), icon: mdiContentCopy, onClick: () => copyText(location.href).then(() => toast.success(t('Copied to clipboard'))) },
  ];

  const cast = () =>
    run(() => castMedia(originalUrl(asset.id, shareKey), asset.originalMimeType ?? 'image/jpeg', asset.originalFileName), { quiet: false });

  return (
    <div className="fixed inset-0 z-[7500] flex bg-black text-white" role="dialog" aria-label={asset.originalFileName}>
      <div className="relative min-w-0 flex-1">
        {showBar && (
          <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-1 bg-gradient-to-b from-black/70 to-transparent px-2 py-2">
            <IconButton path={mdiClose} label={t('Close')} onClick={onClose} />
            <span className="mr-auto ml-2 truncate text-sm text-white/80 max-md:hidden">{asset.originalFileName}</span>
            <span className="mr-auto md:hidden" />
            {preferences.cast.gCastEnabled && <IconButton path={mdiCastConnected} label={t('Cast')} onClick={cast} />}
            {!isVideo && <IconButton path={mdiTextRecognition} label={t('Show text in picture')} active={showText} onClick={() => setShowText(!showText)} />}
            <IconButton path={mdiPlayBoxMultipleOutline} label={t('Slideshow')} onClick={() => setSlideshowDialog(true)} />
            {albumId && <IconButton path={mdiCommentTextOutline} label={t('Activity')} active={panel === 'activity'} onClick={() => togglePanel('activity')} />}
            {inline.map((id) => (
              <IconButton key={id} path={actions[id].icon} label={actions[id].label} onClick={actions[id].run} />
            ))}
            {restore.map((id) => (
              <IconButton key={id} path={actions[id].icon} label={actions[id].label} onClick={actions[id].run} />
            ))}
            <IconButton path={mdiInformationOutline} label={t('Info')} active={panel === 'info'} onClick={() => togglePanel('info')} />
            <Menu trigger={({ toggle }) => <IconButton path={mdiDotsVertical} label={t('More')} onClick={toggle} />} items={menu} />
          </div>
        )}

        {/* the picture */}
        <div className="absolute inset-0">
          {isVideo ? (
            <VideoView asset={asset} shareKey={shareKey} />
          ) : isPanorama ? (
            <Boundary compact>
              <PanoramaView assetId={asset.id} shareKey={shareKey} />
            </Boundary>
          ) : (
            <PhotoView
              asset={asset}
              shareKey={shareKey}
              overlay={
                <>
                  {panel === 'info' && <FaceOverlay asset={asset} />}
                  {showText && <OcrOverlay assetId={asset.id} />}
                </>
              }
            />
          )}
        </div>

        {/* previous / next arrows (not while the bar is hidden by the slideshow) */}
        {showBar && prevId && <IconButton path={mdiChevronLeft} label={t('Previous')} size={32} onClick={() => onShow(prevId)} className="absolute top-1/2 left-2 z-10 -translate-y-1/2 bg-black/40 text-white hover:bg-black/60 max-md:hidden" />}
        {showBar && nextId && <IconButton path={mdiChevronRight} label={t('Next')} size={32} onClick={() => onShow(nextId)} className="absolute top-1/2 right-2 z-10 -translate-y-1/2 bg-black/40 text-white hover:bg-black/60 max-md:hidden" />}

        {showBar && mode === 'view' && similarIds && (
          <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center px-3">
            <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-black/60 p-1" aria-label={t('Similar photos')} role="group">
              {similarIds.map((id, i) => (
                <button
                  key={id}
                  type="button"
                  aria-label={t('Similar photo {n} of {total}', { n: i + 1, total: similarIds.length })}
                  aria-current={id === assetId}
                  onClick={() => onShow(id)}
                  className={cx('size-14 shrink-0 overflow-hidden rounded-lg border-2', id === assetId ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100')}
                >
                  <img src={thumbnailUrl(id, 'thumbnail', shareKey)} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        {slideshow && (
          <>
            <div className="absolute inset-x-0 top-0 z-10 flex justify-center gap-1 p-3 opacity-0 transition hover:opacity-100">
              <div className="flex rounded-full bg-black/60 p-1">
                <IconButton path={mdiChevronLeft} label={t('Previous')} onClick={() => prevId && onShow(prevId)} />
                <IconButton path={slideshow.paused ? mdiPlay : mdiPause} label={slideshow.paused ? t('Resume') : t('Pause')} onClick={() => setSlideshow({ ...slideshow, paused: !slideshow.paused })} />
                <IconButton path={mdiChevronRight} label={t('Next')} onClick={() => nextId && onShow(nextId)} />
                <IconButton path={mdiStop} label={t('Stop slideshow')} onClick={stopSlideshow} />
              </div>
            </div>
            {slideshow.settings.showMetadata && (
              <div className="absolute bottom-6 left-6 z-10 max-w-md rounded-xl bg-black/50 p-3 text-sm">
                <p className="font-medium">{formatDate(asset.localDateTime ?? asset.fileCreatedAt, { dateStyle: 'long' })}</p>
                {asset.exifInfo?.description && <p>{asset.exifInfo.description}</p>}
                <p className="text-white/70">{[asset.exifInfo?.city, asset.exifInfo?.country].filter(Boolean).join(', ')}</p>
              </div>
            )}
          </>
        )}

        {mode === 'edit' && (
          <Boundary>
            <PhotoEditor asset={asset} onClose={() => setMode('view')} onSaved={() => setMode('view')} />
          </Boundary>
        )}
        {mode === 'faces' && (
          <Boundary>
            <FaceEditor asset={asset} onClose={() => setMode('view')} onSaved={() => setMode('view')} />
          </Boundary>
        )}
      </div>

      {panel && !slideshow && mode === 'view' && (
        <div className="max-md:absolute max-md:inset-0 max-md:z-20">
          <Boundary compact>
            {panel === 'info' ? (
              <DetailPanel asset={asset} readOnly={!isOwner} onClose={() => togglePanel('info')} onTagFace={isOwner && !isVideo ? () => setMode('faces') : undefined} />
            ) : (
              albumId && <ActivityPanel albumId={albumId} assetId={asset.id} onClose={() => togglePanel('activity')} />
            )}
          </Boundary>
        </div>
      )}

      {dialogs}
      <Boundary compact fallback={null}>
        {slideshowDialog && <SlideshowSettingsModal onClose={() => setSlideshowDialog(false)} onStart={startSlideshow} />}
      </Boundary>
    </div>
  );
}
