import { useEffect, useRef, useState, type ReactNode } from 'react';
import { mdiImageBrokenVariant, mdiMotionPlayOutline, mdiMotionPauseOutline } from '@mdi/js';
import { thumbnailUrl, videoUrl } from '../../api/assets';
import type { Asset } from '../../api/types';
import { useElementSize } from '../../hooks/useElementWidth';
import { useZoomPan } from '../../hooks/useZoomPan';
import { thumbhashUrl } from '../../lib/thumbhash';
import { IconButton } from '../ui/Button';
import { Icon } from '../ui/Icon';

interface PhotoViewProps {
  asset: Asset;
  shareKey?: string;
  /** Drawn on top of the picture (face boxes, text boxes); positioned with % of the picture size. */
  overlay?: ReactNode;
  /** Called when the zoom state changes: the viewer disables swipe/arrow navigation while zoomed. */
  onZoomChange?: (zoomed: boolean) => void;
}

/**
 * A picture you can zoom (wheel, pinch, double click) and pan.
 * Shows the medium "preview" first for speed, and swaps in the full-size version once it is needed.
 */
export function PhotoView({ asset, shareKey, overlay, onZoomChange }: PhotoViewProps) {
  const area = useRef<HTMLDivElement>(null);
  const { width: aw, height: ah } = useElementSize(area);
  const zoom = useZoomPan(area);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [fullLoaded, setFullLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [livePlaying, setLivePlaying] = useState(false);

  useEffect(() => onZoomChange?.(zoom.zoomed), [zoom.zoomed, onZoomChange]);

  const ratio = asset.width && asset.height ? asset.width / asset.height : 1.5;
  // The size at which the whole picture fits in the area (before zooming).
  const fitW = Math.min(aw, ah * ratio);
  const fitH = fitW / ratio;
  const wantFull = zoom.scale > 1.2;

  return (
    <div ref={area} className="relative flex h-full w-full touch-none items-center justify-center overflow-hidden select-none">
      {failed ? (
        <div className="flex flex-col items-center gap-2 text-white/70">
          <Icon path={mdiImageBrokenVariant} size={64} />
          <p>This picture cannot be shown.</p>
        </div>
      ) : (
        <div className="relative" style={{ width: fitW || undefined, height: fitH || undefined, ...zoom.style, backgroundImage: previewLoaded ? undefined : `url(${thumbhashUrl(asset.thumbhash) ?? ''})`, backgroundSize: 'cover' }}>
          <img
            src={thumbnailUrl(asset.id, 'preview', shareKey)}
            alt={asset.originalFileName}
            draggable={false}
            onLoad={() => setPreviewLoaded(true)}
            onError={() => setFailed(true)}
            className="absolute inset-0 size-full object-contain"
          />
          {wantFull && (
            <img
              src={thumbnailUrl(asset.id, 'fullsize', shareKey)}
              alt=""
              draggable={false}
              onLoad={() => setFullLoaded(true)}
              className="absolute inset-0 size-full object-contain transition-opacity"
              style={{ opacity: fullLoaded ? 1 : 0 }}
            />
          )}
          {livePlaying && asset.livePhotoVideoId && (
            <video src={videoUrl(asset.livePhotoVideoId, shareKey)} autoPlay playsInline onEnded={() => setLivePlaying(false)} className="absolute inset-0 size-full object-contain" />
          )}
          {overlay}
        </div>
      )}

      {asset.livePhotoVideoId && (
        <div className="absolute bottom-4 left-4 rounded-full bg-black/50 text-white">
          <IconButton path={livePlaying ? mdiMotionPauseOutline : mdiMotionPlayOutline} label={livePlaying ? 'Stop live photo' : 'Play live photo'} onClick={() => setLivePlaying(!livePlaying)} />
        </div>
      )}
    </div>
  );
}
