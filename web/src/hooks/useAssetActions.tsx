// What you can do with selected pictures. Used by the timeline's selection bar and by the viewer.
//
// `useAssetActions(assets, context, onDone)` returns:
//   actions - a map id -> { label, icon, run, ... } ready to render as buttons or menu items
//   modals  - the dialogs some actions open (album picker, date, location, ...). Render it once.
import { lazy, useRef, useState, type ReactNode } from 'react';
import {
  mdiArchiveArrowDownOutline,
  mdiArchiveArrowUpOutline,
  mdiCalendarEditOutline,
  mdiCardMultipleOutline,
  mdiDeleteForeverOutline,
  mdiDeleteOutline,
  mdiDownload,
  mdiHeartMinusOutline,
  mdiHeartOutline,
  mdiImageAlbum,
  mdiImageMinusOutline,
  mdiLinkOff,
  mdiLockOpenVariantOutline,
  mdiLockOutline,
  mdiMapMarkerOutline,
  mdiMotionPlayOutline,
  mdiPlusBoxMultipleOutline,
  mdiRestore,
  mdiShareVariantOutline,
  mdiTagOutline,
  mdiTextBoxOutline,
} from '@mdi/js';
import { createStack, deleteAssets, deleteStacks, restoreAssets, updateAssets } from '../api/assets';
import { removeAssetsFromAlbum, removeFromSharedLink } from '../api/library';
import type { GridAsset } from '../components/timeline/gridAsset';
import { Boundary } from '../components/ui/Boundary';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { downloadAssets } from '../lib/download';
import { t } from '../i18n';
import { useToast } from '../state/ToastProvider';
import { useRun } from './useRun';

const AlbumPickerModal = lazy(() => import('../components/modals/AlbumPickerModal'));
const ShareModal = lazy(() => import('../components/modals/ShareModal'));
const ChangeDateModal = lazy(() => import('../components/modals/ChangeDateModal'));
const ChangeDescriptionModal = lazy(() => import('../components/modals/ChangeDescriptionModal'));
const LocationModal = lazy(() => import('../components/modals/LocationModal'));
const TagAssetsModal = lazy(() => import('../components/modals/TagAssetsModal'));

export type ActionId =
  | 'favorite'
  | 'archive'
  | 'lock'
  | 'trash'
  | 'deletePermanent'
  | 'restore'
  | 'download'
  | 'addToAlbum'
  | 'share'
  | 'changeDate'
  | 'changeDescription'
  | 'changeLocation'
  | 'tag'
  | 'stack'
  | 'linkLivePhoto'
  | 'removeFromAlbum'
  | 'removeFromSharedLink';

export interface ActionDef {
  label: string;
  icon: string;
  run: () => void;
  danger?: boolean;
}
export interface ActionContext {
  albumId?: string;
  sharedLinkId?: string;
  shareKey?: string;
}

// After any change, everything that shows pictures must refresh.
const REFRESH = [['timeline'], ['asset'], ['albums'], ['album'], ['asset-statistics'], ['search'], ['people'], ['memories']];

type ModalName = 'album' | 'share' | 'date' | 'description' | 'location' | 'tag' | 'confirm-delete' | 'confirm-trash' | null;

/** `onDone(id)` runs after an action succeeded; `id` says which one (the viewer moves on after a delete). */
export function useAssetActions(assets: GridAsset[], context: ActionContext, onDone: (id: ActionId) => void) {
  const run = useRun();
  const toast = useToast();
  const [modal, setModal] = useState<ModalName>(null);
  const last = useRef<ActionId>('favorite'); // the action the user started most recently
  const ids = assets.map((a) => a.id);
  const allFavorite = assets.length > 0 && assets.every((a) => a.isFavorite);
  const allArchived = assets.length > 0 && assets.every((a) => a.isArchived);
  const allLocked = assets.length > 0 && assets.every((a) => a.isLocked);
  const stacked = assets.length === 1 && assets[0].stackCount > 1;

  const finish = () => onDone(last.current);
  const change = (fn: () => Promise<unknown>, success: string) => async () => {
    const result = await run(fn, { success, invalidate: REFRESH });
    if (result.ok) finish();
  };

  const actions: Record<ActionId, ActionDef> = {
    favorite: allFavorite
      ? { label: t('Remove from favorites'), icon: mdiHeartMinusOutline, run: change(() => updateAssets(ids, { isFavorite: false }), t('Removed from favorites')) }
      : { label: t('Favorite'), icon: mdiHeartOutline, run: change(() => updateAssets(ids, { isFavorite: true }), t('Added to favorites')) },
    archive: allArchived
      ? { label: t('Unarchive'), icon: mdiArchiveArrowUpOutline, run: change(() => updateAssets(ids, { visibility: 'timeline' }), t('Moved back to the timeline')) }
      : { label: t('Archive'), icon: mdiArchiveArrowDownOutline, run: change(() => updateAssets(ids, { visibility: 'archive' }), t('Archived')) },
    lock: allLocked
      ? { label: t('Remove from locked folder'), icon: mdiLockOpenVariantOutline, run: change(() => updateAssets(ids, { visibility: 'timeline' }), t('Removed from locked folder')) }
      : { label: t('Move to locked folder'), icon: mdiLockOutline, run: change(() => updateAssets(ids, { visibility: 'locked' }), t('Moved to locked folder')) },
    trash: { label: t('Delete'), icon: mdiDeleteOutline, run: () => setModal('confirm-trash'), danger: true },
    deletePermanent: { label: t('Delete permanently'), icon: mdiDeleteForeverOutline, run: () => setModal('confirm-delete'), danger: true },
    restore: { label: t('Restore'), icon: mdiRestore, run: change(() => restoreAssets(ids), t('Restored')) },
    download: {
      label: t('Download'),
      icon: mdiDownload,
      run: async () => {
        const result = await run(() => downloadAssets(ids, context.shareKey));
        if (result.ok && result.data === 'each') toast.info(t('The server cannot make zip files yet, so files are downloaded one by one.'));
      },
    },
    addToAlbum: { label: t('Add to album'), icon: mdiImageAlbum, run: () => setModal('album') },
    share: { label: t('Share'), icon: mdiShareVariantOutline, run: () => setModal('share') },
    changeDate: { label: t('Change date'), icon: mdiCalendarEditOutline, run: () => setModal('date') },
    changeDescription: { label: t('Change description'), icon: mdiTextBoxOutline, run: () => setModal('description') },
    changeLocation: { label: t('Change location'), icon: mdiMapMarkerOutline, run: () => setModal('location') },
    tag: { label: t('Tag'), icon: mdiTagOutline, run: () => setModal('tag') },
    stack: stacked
      ? { label: t('Unstack'), icon: mdiCardMultipleOutline, run: change(() => deleteStacks([assets[0].id]), t('Unstacked')) }
      : { label: t('Stack'), icon: mdiPlusBoxMultipleOutline, run: change(() => createStack(ids), t('Stacked')) },
    linkLivePhoto: {
      label: t('Link live photo'),
      icon: mdiMotionPlayOutline,
      run: change(async () => {
        // exactly one photo and one video: the video becomes the photo's motion part
        const photo = assets.find((a) => !a.isVideo);
        const video = assets.find((a) => a.isVideo);
        if (assets.length !== 2 || !photo || !video) throw new Error(t('Select one photo and one video'));
        return updateAssets([photo.id], { livePhotoVideoId: video.id });
      }, t('Live photo linked')),
    },
    removeFromAlbum: {
      label: t('Remove from album'),
      icon: mdiImageMinusOutline,
      run: change(() => removeAssetsFromAlbum(context.albumId!, ids), t('Removed from album')),
    },
    removeFromSharedLink: {
      label: t('Remove from shared link'),
      icon: mdiLinkOff,
      run: change(() => removeFromSharedLink(context.sharedLinkId!, ids), t('Removed from shared link')),
    },
  };

  // Remember which action was clicked, so `finish` can report it (also after a confirm dialog).
  for (const id of Object.keys(actions) as ActionId[]) {
    const original = actions[id].run;
    actions[id].run = () => {
      last.current = id;
      original();
    };
  }

  const close = () => setModal(null);
  const done = () => {
    close();
    finish();
  };
  const dialogs: ReactNode = (
    <>
      {modal === 'confirm-trash' && (
        <ConfirmDialog
          title={t('Delete {count} item(s)?', { count: ids.length })}
          message={t('They will be moved to the trash and removed automatically later.')}
          confirmText="Delete"
          danger
          onClose={close}
          onConfirm={change(() => deleteAssets(ids, false), t('Moved to trash'))}
        />
      )}
      {modal === 'confirm-delete' && (
        <ConfirmDialog
          title={t('Delete permanently?')}
          message={t('{count} item(s) will be deleted for good. This cannot be undone.', { count: ids.length })}
          confirmText="Delete"
          danger
          onClose={close}
          onConfirm={change(() => deleteAssets(ids, true), t('Deleted'))}
        />
      )}
      <Boundary compact fallback={null}>
        {modal === 'album' && <AlbumPickerModal assetIds={ids} onClose={close} onDone={done} />}
        {modal === 'share' && <ShareModal assetIds={ids} onClose={close} />}
        {modal === 'date' && <ChangeDateModal assetIds={ids} onClose={close} onDone={done} />}
        {modal === 'description' && <ChangeDescriptionModal assetIds={ids} onClose={close} onDone={done} />}
        {modal === 'location' && <LocationModal assetIds={ids} onClose={close} onDone={done} />}
        {modal === 'tag' && <TagAssetsModal assetIds={ids} onClose={close} onDone={done} />}
      </Boundary>
    </>
  );

  return { actions, dialogs };
}
