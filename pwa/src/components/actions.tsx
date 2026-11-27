// Changes to photos, using the web app's API calls. Every change reloads the lists.
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { mdiImageAlbum, mdiPlus } from '@mdi/js';
import { deleteAssets, restoreAssets, updateAssets } from '@web/api/assets';
import { errorMessage } from '@web/api/client';
import { addAssetsToAlbum, createAlbum, getAlbums } from '@web/api/library';
import { useToast } from '@web/state/ToastProvider';
import { Row, Sheet, Spinner } from './ui';

export function useActions() {
  const qc = useQueryClient();
  const toast = useToast();
  /** Runs one change; resolves true when it worked. */
  const run = async (change: () => Promise<unknown>, done: string) => {
    try {
      await change();
      toast.success(done);
      for (const key of ['timeline', 'search', 'asset', 'albums', 'album']) void qc.invalidateQueries({ queryKey: [key] });
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    }
  };
  const count = (ids: string[]) => (ids.length === 1 ? '1 item' : `${ids.length} items`);
  return {
    favorite: (ids: string[], on: boolean) => run(() => updateAssets(ids, { isFavorite: on }), on ? 'Added to favorites' : 'Removed from favorites'),
    archive: (ids: string[], on: boolean) => run(() => updateAssets(ids, { visibility: on ? 'archive' : 'timeline' }), on ? 'Archived' : 'Unarchived'),
    remove: (ids: string[], forever: boolean) => run(() => deleteAssets(ids, forever), `${count(ids)} deleted`),
    restore: (ids: string[]) => run(() => restoreAssets(ids), `${count(ids)} restored`),
    addToAlbum: (albumId: string, ids: string[]) => run(() => addAssetsToAlbum(albumId, ids), 'Added to the album'),
    newAlbum: (name: string, ids: string[]) => run(() => createAlbum({ albumName: name, assetIds: ids }), `Album “${name}” created`),
  };
}

export function AlbumPicker({ ids, onClose }: { ids: string[]; onClose: (added: boolean) => void }) {
  const actions = useActions();
  const albums = useQuery({ queryKey: ['albums'], queryFn: () => getAlbums() });
  const [name, setName] = useState('');
  const finish = async (change: Promise<boolean>) => (await change) && onClose(true);
  return (
    <Sheet title="Add to album" onClose={() => onClose(false)}>
      <form
        className="mb-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) void finish(actions.newAlbum(name.trim(), ids));
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New album name" className="min-w-0 flex-1 rounded-full bg-panel px-4 py-2.5 text-sm outline-none" />
        <button type="submit" disabled={!name.trim()} aria-label="Create album" className="rounded-full bg-primary px-4 text-on-primary">
          <svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor" aria-hidden="true">
            <path d={mdiPlus} />
          </svg>
        </button>
      </form>
      {albums.isLoading && <Spinner />}
      {(albums.data ?? []).map((album) => (
        <Row key={album.id} icon={mdiImageAlbum} label={album.albumName} onClick={() => void finish(actions.addToAlbum(album.id, ids))}>
          <span className="text-xs text-muted">{album.assetCount}</span>
        </Row>
      ))}
    </Sheet>
  );
}
