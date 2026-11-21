import { lazy, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  mdiAccountOutline,
  mdiCalendarOutline,
  mdiCameraIris,
  mdiClose,
  mdiImageOutline,
  mdiImageAlbum,
  mdiMapMarkerOutline,
  mdiPencil,
  mdiPlus,
  mdiTagOutline,
} from '@mdi/js';
import { useQuery } from '@tanstack/react-query';
import { personThumbnailUrl, updateAsset } from '../../api/assets';
import { getAlbums } from '../../api/library';
import type { Asset } from '../../api/types';
import { useMapStyle } from '../map/useMapStyle';
import { usePreferences } from '../../hooks/usePreferences';
import { useRun } from '../../hooks/useRun';
import { t } from '../../i18n';
import { formatBytes, formatDateTime } from '../../lib/format';
import { Boundary } from '../ui/Boundary';
import { IconButton } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { StarRating, TagPill } from '../ui/Misc';

const ChangeDateModal = lazy(() => import('../modals/ChangeDateModal'));
const LocationModal = lazy(() => import('../modals/LocationModal'));
const TagAssetsModal = lazy(() => import('../modals/TagAssetsModal'));
const LocationPicker = lazy(() => import('../map/LocationPicker'));

function Section({ icon, title, action, children }: { icon: string; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-b border-line px-5 py-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted">
        <Icon path={icon} size={20} />
        <span className="flex-1">{title}</span>
        {action}
      </div>
      <div className="text-sm">{children}</div>
    </section>
  );
}

interface DetailPanelProps {
  asset: Asset;
  /** The picture belongs to someone else or is shown on a public page: nothing can be edited. */
  readOnly?: boolean;
  onClose: () => void;
  /** Start drawing a face box (opens the face editor). */
  onTagFace?: () => void;
}

/** The right-hand "info" panel: description, people, date, file, camera, location, tags, albums. */
export default function DetailPanel({ asset, readOnly, onClose, onTagFace }: DetailPanelProps) {
  const run = useRun();
  const { preferences } = usePreferences();
  const hasMap = !!useMapStyle();
  const exif = asset.exifInfo ?? {};
  const [description, setDescription] = useState(exif.description ?? '');
  const [modal, setModal] = useState<'date' | 'location' | 'tag' | null>(null);
  const albums = useQuery({ queryKey: ['albums', 'of-asset', asset.id], queryFn: () => getAlbums({ assetId: asset.id }), retry: false, enabled: !readOnly });

  useEffect(() => setDescription(exif.description ?? ''), [asset.id, exif.description]);

  const saveDescription = () =>
    description !== (exif.description ?? '') && run(() => updateAsset(asset.id, { description }), { success: t('Description saved'), invalidate: [['asset']] });
  const done = () => setModal(null);
  const edit = (name: 'date' | 'location' | 'tag') => !readOnly && <IconButton path={name === 'tag' ? mdiPlus : mdiPencil} label={t('Edit')} size={18} onClick={() => setModal(name)} />;
  const hasLocation = exif.latitude != null && exif.longitude != null;
  const megapixels = asset.width && asset.height ? ((asset.width * asset.height) / 1e6).toFixed(1) : null;

  return (
    <aside className="flex h-full w-full shrink-0 flex-col overflow-y-auto border-l border-line bg-bg text-fg md:w-[22rem]" aria-label={t('Details')}>
      <div className="flex items-center gap-2 px-3 py-2">
        <IconButton path={mdiClose} label={t('Close')} onClick={onClose} />
        <h2 className="font-semibold">{t('Info')}</h2>
      </div>

      {(asset.people?.length ?? 0) > 0 || !readOnly ? (
        <Section icon={mdiAccountOutline} title={t('People')} action={!readOnly && onTagFace && <IconButton path={mdiPlus} label={t('Tag a person')} size={18} onClick={onTagFace} />}>
          <div className="flex flex-wrap gap-3">
            {(asset.people ?? []).map((p) => (
              <Link key={p.id} to={`/people/${p.id}`} className="flex w-20 flex-col items-center gap-1 text-center">
                <img src={personThumbnailUrl(p.id)} alt="" className="size-16 rounded-full bg-panel object-cover" />
                <span className="w-full truncate text-xs">{p.name || t('Unknown')}</span>
              </Link>
            ))}
            {(asset.people?.length ?? 0) === 0 && <span className="text-muted">{t('No people detected')}</span>}
          </div>
        </Section>
      ) : null}

      <div className="border-b border-line px-5 py-4">
        {readOnly ? (
          <p className="text-sm">{description || <span className="text-muted">{t('No description')}</span>}</p>
        ) : (
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={saveDescription}
            placeholder={t('Add a description')}
            rows={2}
            className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted"
          />
        )}
        {preferences.ratings.enabled && !readOnly && (
          <div className="mt-2">
            <StarRating value={exif.rating ?? 0} onChange={(rating) => run(() => updateAsset(asset.id, { rating }), { invalidate: [['asset']] })} />
          </div>
        )}
      </div>

      <Section icon={mdiCalendarOutline} title={t('Date')} action={edit('date')}>
        <p>{formatDateTime(asset.localDateTime ?? asset.fileCreatedAt)}</p>
        {exif.timeZone && <p className="text-xs text-muted">{exif.timeZone}</p>}
      </Section>

      <Section icon={mdiImageOutline} title={t('Details')}>
        <p className="break-all">{asset.originalFileName}</p>
        <p className="text-xs text-muted">
          {[asset.width && asset.height ? `${asset.width} × ${asset.height}` : null, megapixels ? `${megapixels} MP` : null, formatBytes(exif.fileSizeInByte)].filter(Boolean).join(' · ')}
        </p>
      </Section>

      {(exif.make || exif.model || exif.lensModel || exif.fNumber || exif.iso) && (
        <Section icon={mdiCameraIris} title={t('Camera')}>
          <p>{[exif.make, exif.model].filter(Boolean).join(' ')}</p>
          {exif.lensModel && <p className="text-xs text-muted">{exif.lensModel}</p>}
          <p className="text-xs text-muted">
            {[exif.fNumber && `ƒ/${exif.fNumber}`, exif.exposureTime && `${exif.exposureTime}s`, exif.focalLength && `${exif.focalLength} mm`, exif.iso && `ISO ${exif.iso}`].filter(Boolean).join('  ')}
          </p>
        </Section>
      )}

      {(hasLocation || !readOnly) && (
        <Section icon={mdiMapMarkerOutline} title={t('Location')} action={edit('location')}>
          {hasLocation ? (
            <>
              <p>{[exif.city, exif.state, exif.country].filter(Boolean).join(', ') || `${exif.latitude!.toFixed(4)}, ${exif.longitude!.toFixed(4)}`}</p>
              {hasMap && (
                <div className="mt-2">
                  <Boundary compact fallback={<div className="h-40 animate-pulse rounded-xl bg-panel" />}>
                    <LocationPicker lat={exif.latitude!} lon={exif.longitude!} onChange={() => undefined} className="pointer-events-none h-40 w-full overflow-hidden rounded-xl" />
                  </Boundary>
                </div>
              )}
            </>
          ) : (
            <p className="text-muted">{t('No location')}</p>
          )}
        </Section>
      )}

      {(!readOnly || (asset.tags?.length ?? 0) > 0) && preferences.tags.enabled !== false && (
        <Section icon={mdiTagOutline} title={t('Tags')} action={edit('tag')}>
          <div className="flex flex-wrap gap-2">
            {(asset.tags ?? []).map((tag) => (
              <Link key={tag.id} to={`/tags?path=${encodeURIComponent(tag.value)}`}>
                <TagPill>{tag.value}</TagPill>
              </Link>
            ))}
            {(asset.tags?.length ?? 0) === 0 && <span className="text-muted">{t('No tags')}</span>}
          </div>
        </Section>
      )}

      {(albums.data?.length ?? 0) > 0 && (
        <Section icon={mdiImageAlbum} title={t('Appears in')}>
          <ul className="space-y-1">
            {albums.data!.map((a) => (
              <li key={a.id}>
                <Link className="text-primary hover:underline" to={`/albums/${a.id}`}>
                  {a.albumName}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Boundary compact fallback={null}>
        {modal === 'date' && <ChangeDateModal assetIds={[asset.id]} current={asset.localDateTime?.slice(0, 16)} onClose={done} onDone={done} />}
        {modal === 'location' && <LocationModal assetIds={[asset.id]} lat={exif.latitude ?? undefined} lon={exif.longitude ?? undefined} onClose={done} onDone={done} />}
        {modal === 'tag' && <TagAssetsModal assetIds={[asset.id]} onClose={done} onDone={done} />}
      </Boundary>
    </aside>
  );
}
