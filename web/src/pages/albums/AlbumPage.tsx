import { lazy, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  mdiArrowLeft,
  mdiCogOutline,
  mdiDeleteOutline,
  mdiDownload,
  mdiImageAlbum,
  mdiImagePlusOutline,
  mdiMapOutline,
  mdiShareVariantOutline,
} from '@mdi/js';
import { useQuery } from '@tanstack/react-query';
import { addAssetsToAlbum, deleteAlbum, getAlbum, getMapMarkers, removeAlbumUser, updateAlbum } from '../../api/library';
import { albumDateRange } from '../../components/albums/AlbumCard';
import { ALBUM_ACTIONS, READONLY_ACTIONS } from '../../components/timeline/presets';
import { Timeline } from '../../components/timeline/Timeline';
import { Boundary } from '../../components/ui/Boundary';
import { IconButton, Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState, Avatar } from '../../components/ui/Misc';
import { PageSpinner } from '../../components/ui/Spinner';
import { useAssetRoute } from '../../hooks/useAssetRoute';
import { useRun } from '../../hooks/useRun';
import { useServerConfig } from '../../hooks/useServer';
import { t } from '../../i18n';
import { downloadAssets } from '../../lib/download';
import { useAuth } from '../../state/AuthProvider';
import { UploadButton } from '../../components/upload/UploadButton';
import { getTimelineBuckets, getTimelineBucket, zipBucket } from '../../api/assets';

const AssetPickerModal = lazy(() => import('../../components/modals/AssetPickerModal'));
const AlbumOptionsModal = lazy(() => import('../../components/modals/AlbumOptionsModal'));
const ShareModal = lazy(() => import('../../components/modals/ShareModal'));
const MapView = lazy(() => import('../../components/map/MapView'));

/** One album: editable title, members, actions, and the album's pictures as a timeline. */
export default function AlbumPage() {
  const { albumId = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const run = useRun();
  const hasMap = useServerConfig().data?.mapLightStyleUrl;
  const album = useQuery({ queryKey: ['album', albumId], queryFn: () => getAlbum(albumId), retry: false });
  const [modal, setModal] = useState<'add' | 'options' | 'share' | 'delete' | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const base = `/albums/${albumId}`;
  const route = useAssetRoute(base);
  const a = album.data;

  useEffect(() => {
    if (a) {
      setName(a.albumName);
      setDescription(a.description ?? '');
    }
  }, [a?.id, a?.albumName, a?.description]); // eslint-disable-line react-hooks/exhaustive-deps

  const markers = useQuery({ queryKey: ['map', 'album', albumId], queryFn: () => getMapMarkers({ albumId }), enabled: showMap, retry: false });

  if (album.isLoading) return <PageSpinner />;
  if (album.isError || !a) {
    return (
      <EmptyState icon={mdiImageAlbum} title={t('Album not available')} text={(album.error as Error)?.message}>
        <Link to="/albums">
          <Button>{t('Back to albums')}</Button>
        </Link>
      </EmptyState>
    );
  }

  const isOwner = a.owner.id === user?.id;
  const myRole = a.albumUsers.find((m) => m.user.id === user?.id)?.role;
  const canAdd = isOwner || myRole === 'editor';
  const saveName = () => name.trim() && name !== a.albumName && run(() => updateAlbum(a.id, { albumName: name.trim() }), { invalidate: [['album', a.id], ['albums']] });
  const saveDescription = () => description !== (a.description ?? '') && run(() => updateAlbum(a.id, { description }), { invalidate: [['album', a.id]] });

  const downloadAll = async () => {
    // Collect every id of the album (all months), then hand them to the shared download helper.
    const buckets = await getTimelineBuckets({ albumId: a.id });
    const ids = (await Promise.all(buckets.map((b) => getTimelineBucket(b.timeBucket, { albumId: a.id }).then(zipBucket)))).flat().map((x) => x.id);
    await run(() => downloadAssets(ids));
  };

  const header = (
    <header className="px-1 pt-4 pb-3">
      <div className="mb-3 flex items-center gap-1">
        <IconButton path={mdiArrowLeft} label={t('Back')} onClick={() => navigate('/albums')} />
        <span className="flex-1" />
        {canAdd && (
          <>
            <Button variant="outline" size="sm" icon={mdiImagePlusOutline} onClick={() => setModal('add')}>
              <span className="max-md:hidden">{t('Add photos')}</span>
            </Button>
            <UploadButton albumId={a.id} compact />
          </>
        )}
        {isOwner && <IconButton path={mdiShareVariantOutline} label={t('Share')} onClick={() => setModal('share')} />}
        <IconButton path={mdiDownload} label={t('Download')} onClick={downloadAll} />
        {hasMap && <IconButton path={mdiMapOutline} label={t('Map')} active={showMap} onClick={() => setShowMap(!showMap)} />}
        <IconButton path={mdiCogOutline} label={t('Options')} onClick={() => setModal('options')} />
        {isOwner ? (
          <IconButton path={mdiDeleteOutline} label={t('Delete album')} onClick={() => setModal('delete')} />
        ) : (
          <Button variant="outline" size="sm" onClick={() => run(() => removeAlbumUser(a.id, user!.id), { success: t('You left the album'), invalidate: [['albums']] }).then((r) => r.ok && navigate('/albums'))}>
            {t('Leave')}
          </Button>
        )}
      </div>
      <input
        value={name}
        readOnly={!isOwner}
        onChange={(e) => setName(e.target.value)}
        onBlur={saveName}
        aria-label={t('Album name')}
        className="w-full rounded-lg bg-transparent px-2 py-1 text-4xl font-semibold outline-none hover:bg-panel focus:bg-panel read-only:hover:bg-transparent"
      />
      <p className="px-2 text-sm text-muted">
        {t('{count} items', { count: a.assetCount })} {albumDateRange(a) && `· ${albumDateRange(a)}`}
      </p>
      <textarea
        value={description}
        readOnly={!isOwner}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={saveDescription}
        placeholder={isOwner ? t('Add a description') : ''}
        rows={1}
        className="mt-1 w-full resize-none rounded-lg bg-transparent px-2 py-1 text-sm outline-none hover:bg-panel focus:bg-panel read-only:hover:bg-transparent"
      />
      {(a.shared || a.albumUsers.length > 0) && (
        <div className="mt-2 flex items-center gap-1 px-2">
          <Avatar user={a.owner} size={32} />
          {a.albumUsers.map((m) => (
            <Avatar key={m.user.id} user={m.user} size={32} />
          ))}
        </div>
      )}
      {showMap && (
        <div className="mt-3 h-72 overflow-hidden rounded-2xl">
          <Boundary compact>
            <MapView markers={markers.data ?? []} onOpenAsset={(id) => route.open(id)} />
          </Boundary>
        </div>
      )}
    </header>
  );

  return (
    <div className="h-full">
      <Timeline
        query={{ albumId: a.id, order: a.order ?? 'desc' }}
        base={base}
        albumId={a.isActivityEnabled || a.shared ? a.id : undefined}
        actions={canAdd ? ALBUM_ACTIONS : READONLY_ACTIONS}
        actionContext={{ albumId: a.id }}
        readOnly={!canAdd}
        header={header}
        customActions={
          isOwner
            ? [
                {
                  id: 'cover',
                  label: t('Use as album cover'),
                  icon: mdiImageAlbum,
                  hidden: (sel) => sel.length !== 1,
                  run: (ids) => run(() => updateAlbum(a.id, { albumThumbnailAssetId: ids[0] }), { success: t('Album cover changed'), invalidate: [['album', a.id], ['albums']] }),
                },
              ]
            : undefined
        }
        empty={
          <EmptyState icon={mdiImageAlbum} title={t('This album is empty')} text={canAdd ? t('Add photos from your library or upload new ones.') : undefined}>
            {canAdd && (
              <Button icon={mdiImagePlusOutline} onClick={() => setModal('add')}>
                {t('Add photos')}
              </Button>
            )}
          </EmptyState>
        }
      />
      <Boundary compact fallback={null}>
        {modal === 'add' && (
          <AssetPickerModal
            title={t('Add photos to {album}', { album: a.albumName })}
            pick={{ label: t('Add to album'), onPick: (ids) => run(() => addAssetsToAlbum(a.id, ids), { success: t('Photos added'), invalidate: [['timeline'], ['album', a.id], ['albums']] }) }}
            onClose={() => setModal(null)}
          />
        )}
        {modal === 'options' && <AlbumOptionsModal album={a} onClose={() => setModal(null)} />}
        {modal === 'share' && <ShareModal albumId={a.id} onClose={() => setModal(null)} />}
      </Boundary>
      {modal === 'delete' && (
        <ConfirmDialog
          title={t('Delete album?')}
          message={t('The album "{name}" will be deleted. Its photos stay in your library.', { name: a.albumName })}
          confirmText="Delete"
          danger
          onClose={() => setModal(null)}
          onConfirm={() => run(() => deleteAlbum(a.id), { success: t('Album deleted'), invalidate: [['albums']] }).then((r) => r.ok && navigate('/albums'))}
        />
      )}
    </div>
  );
}
