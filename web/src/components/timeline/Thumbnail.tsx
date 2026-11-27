import { memo, useState } from 'react';
import {
  mdiArchiveArrowDownOutline,
  mdiCheckCircle,
  mdiCircleOutline,
  mdiHeart,
  mdiImageBrokenVariant,
  mdiMotionPlayOutline,
  mdiPanoramaVariantOutline,
  mdiPlayCircleOutline,
  mdiLockOutline,
  mdiCardMultipleOutline,
} from '@mdi/js';
import { thumbnailUrl } from '../../api/assets';
import { cx } from '../../lib/cx';
import { formatDuration } from '../../lib/format';
import { thumbhashUrl } from '../../lib/thumbhash';
import { Icon } from '../ui/Icon';
import type { GridAsset } from './gridAsset';
import { useSelectionContext } from './selection';

interface ThumbnailProps {
  asset: GridAsset;
  width: number;
  height: number;
  /** Shared-link key for public pages. */
  shareKey?: string;
  onOpen: (id: string) => void;
  selectable?: boolean;
}

/** One picture in the grid: blurred placeholder, lazy image, and the small badges. */
export const Thumbnail = memo(function Thumbnail({ asset, width, height, shareKey, onOpen, selectable = true }: ThumbnailProps) {
  const selection = useSelectionContext();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  // a tile that stands for several similar photos is selected when all of them are, and selects all of them
  const selected = !!selection && (asset.similarIds ?? [asset.id]).every((id) => selection.has(id));
  const selecting = !!selection && (selection.active || selection.alwaysSelect);

  const toggle = (range: boolean) => {
    selection!.toggle(asset.id, range);
    if (asset.similarIds) selection!.setMany(asset.similarIds, range || !selected);
  };
  const click = (e: React.MouseEvent) => {
    if (selecting && selectable) toggle(e.shiftKey);
    else onOpen(asset.id);
  };

  return (
    <div
      className="group relative shrink-0 cursor-pointer overflow-hidden bg-panel"
      style={{ width, height, backgroundImage: loaded ? undefined : `url(${thumbhashUrl(asset.thumbhash) ?? ''})`, backgroundSize: 'cover' }}
      onClick={click}
      role="button"
      tabIndex={0}
      aria-label={asset.isVideo ? 'Video' : 'Photo'}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), click(e as unknown as React.MouseEvent))}
      data-asset-id={asset.id}
    >
      {failed ? (
        <div className="flex size-full items-center justify-center text-muted">
          <Icon path={mdiImageBrokenVariant} size={32} />
        </div>
      ) : (
        <img
          src={thumbnailUrl(asset.id, 'thumbnail', shareKey)}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cx('size-full object-cover transition duration-200', selected && 'scale-90 rounded-lg', !loaded && 'opacity-0')}
        />
      )}

      {/* darkening on hover and top gradient so white icons stay readable */}
      <div className={cx('pointer-events-none absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-transparent opacity-0 transition group-hover:opacity-100', selected && 'opacity-100')} />

      {selectable && selection && (
        <button
          type="button"
          aria-label={selected ? 'Unselect' : 'Select'}
          aria-pressed={selected}
          onClick={(e) => {
            e.stopPropagation();
            toggle(e.shiftKey);
          }}
          className={cx('absolute top-1.5 left-1.5 text-white drop-shadow transition', selected ? 'text-primary opacity-100' : 'opacity-0 group-hover:opacity-100', selecting && 'opacity-100')}
        >
          <span className={cx('flex rounded-full', selected && 'bg-white')}>
            <Icon path={selected ? mdiCheckCircle : mdiCircleOutline} size={24} />
          </span>
        </button>
      )}

      <div className="pointer-events-none absolute top-1.5 right-1.5 flex items-center gap-1 text-white drop-shadow">
        {asset.isVideo && <span className="text-xs font-medium">{formatDuration(asset.duration)}</span>}
        {asset.isVideo && <Icon path={mdiPlayCircleOutline} size={20} />}
        {asset.isLivePhoto && <Icon path={mdiMotionPlayOutline} size={20} />}
        {asset.isPanorama && <Icon path={mdiPanoramaVariantOutline} size={20} />}
        {asset.stackCount > 1 && (
          <span className="flex items-center gap-0.5 text-xs">
            <Icon path={mdiCardMultipleOutline} size={18} />
            {asset.stackCount}
          </span>
        )}
      </div>
      <div className="pointer-events-none absolute bottom-1.5 left-1.5 flex gap-1 text-white drop-shadow">
        {asset.isFavorite && <Icon path={mdiHeart} size={18} />}
        {asset.isArchived && <Icon path={mdiArchiveArrowDownOutline} size={18} />}
        {asset.isLocked && <Icon path={mdiLockOutline} size={18} />}
      </div>
    </div>
  );
});
