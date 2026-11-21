import { Link } from 'react-router';
import { mdiImageAlbum } from '@mdi/js';
import { thumbnailUrl } from '../../api/assets';
import type { Album } from '../../api/types';
import { t } from '../../i18n';
import { formatDate } from '../../lib/format';
import { Icon } from '../ui/Icon';

export function AlbumCover({ album, className }: { album: Pick<Album, 'albumThumbnailAssetId'>; className?: string }) {
  return album.albumThumbnailAssetId ? (
    <img src={thumbnailUrl(album.albumThumbnailAssetId)} alt="" loading="lazy" className={`object-cover ${className ?? ''}`} />
  ) : (
    <div className={`flex items-center justify-center bg-panel text-muted ${className ?? ''}`}>
      <Icon path={mdiImageAlbum} size={48} />
    </div>
  );
}

/** Square cover with the name underneath. */
export function AlbumCard({ album, mine }: { album: Album; mine: boolean }) {
  return (
    <Link to={`/albums/${album.id}`} className="group block w-full">
      <div className="aspect-square overflow-hidden rounded-2xl">
        <AlbumCover album={album} className="size-full transition group-hover:scale-105" />
      </div>
      <p className="mt-2 truncate font-medium">{album.albumName}</p>
      <p className="truncate text-xs text-muted">
        {t('{count} items', { count: album.assetCount })}
        {!mine && ` · ${t('by {name}', { name: album.owner.name })}`}
        {album.shared && mine && ` · ${t('Shared')}`}
      </p>
    </Link>
  );
}

export const albumDateRange = (album: Album) =>
  album.startDate ? `${formatDate(album.startDate)}${album.endDate && album.endDate !== album.startDate ? ` - ${formatDate(album.endDate)}` : ''}` : '';
