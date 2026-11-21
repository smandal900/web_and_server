import { useState } from 'react';
import { mdiImageAlbum, mdiPlus } from '@mdi/js';
import { useQuery } from '@tanstack/react-query';
import { thumbnailUrl } from '../../api/assets';
import { addAssetsToAlbum, createAlbum, getAlbums } from '../../api/library';
import { useRun } from '../../hooks/useRun';
import { t } from '../../i18n';
import { Button } from '../ui/Button';
import { TextField } from '../ui/Fields';
import { Icon } from '../ui/Icon';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/Spinner';

/** Choose an existing album (or create one) and add the given assets to it. */
export default function AlbumPickerModal({ assetIds, onClose, onDone }: { assetIds: string[]; onClose: () => void; onDone: () => void }) {
  const run = useRun();
  const albums = useQuery({ queryKey: ['albums'], queryFn: () => getAlbums(), retry: false });
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const shown = (albums.data ?? []).filter((a) => a.albumName.toLowerCase().includes(search.toLowerCase()));

  const addTo = async (id: string, albumName: string) => {
    const r = await run(() => addAssetsToAlbum(id, assetIds), { success: t('Added to {album}', { album: albumName }), invalidate: [['albums'], ['album']] });
    if (r.ok) onDone();
  };
  const create = async () => {
    const r = await run(() => createAlbum({ albumName: name.trim(), assetIds }), { success: t('Album created'), invalidate: [['albums']] });
    if (r.ok) onDone();
  };

  return (
    <Modal title={t('Add to album')} onClose={onClose}>
      <div className="mb-4 flex items-end gap-2">
        <div className="flex-1">
          <TextField label={t('New album')} placeholder={t('Album name')} value={name} onChange={setName} />
        </div>
        <Button icon={mdiPlus} disabled={!name.trim()} onClick={create}>
          {t('Create')}
        </Button>
      </div>
      <TextField placeholder={t('Search albums')} value={search} onChange={setSearch} />
      <ul className="mt-3 max-h-72 divide-y divide-line overflow-y-auto">
        {albums.isLoading && (
          <li className="flex justify-center p-4">
            <Spinner />
          </li>
        )}
        {shown.map((album) => (
          <li key={album.id}>
            <button onClick={() => addTo(album.id, album.albumName)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-panel">
              {album.albumThumbnailAssetId ? (
                <img src={thumbnailUrl(album.albumThumbnailAssetId)} alt="" className="size-12 rounded-lg object-cover" />
              ) : (
                <span className="flex size-12 items-center justify-center rounded-lg bg-panel text-muted">
                  <Icon path={mdiImageAlbum} />
                </span>
              )}
              <span>
                <span className="block text-sm font-medium">{album.albumName}</span>
                <span className="block text-xs text-muted">{t('{count} items', { count: album.assetCount })}</span>
              </span>
            </button>
          </li>
        ))}
        {!albums.isLoading && shown.length === 0 && <li className="p-4 text-center text-sm text-muted">{t('No albums yet. Create one above.')}</li>}
      </ul>
    </Modal>
  );
}
