// Every screen that lists photos by month: Photos, Favorites, Archive, Bin and one album.
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { mdiArrowLeft, mdiCloudUploadOutline } from '@mdi/js';
import { errorMessage } from '@web/api/client';
import { getAlbum } from '@web/api/library';
import type { TimelineQuery } from '@web/api/types';
import { useTimelineBuckets, useTimelineMonths } from '@web/hooks/useTimeline';
import { useAuth } from '@web/state/AuthProvider';
import { Gallery, type GalleryKind } from '../components/Gallery';
import { IconButton, Message, TopBar } from '../components/ui';
import { UploadButton } from '../components/Upload';

function Timeline({ kind, query, empty, header }: { kind: GalleryKind; query: TimelineQuery; empty: string; header?: ReactNode }) {
  const buckets = useTimelineBuckets(query);
  const list = useMemo(() => buckets.data ?? [], [buckets.data]);
  const [wanted, setWanted] = useState<string[]>([]);
  const onNear = useCallback((month: string) => setWanted((w) => (w.includes(month) ? w : [...w, month])), []);
  const { byMonth } = useTimelineMonths(wanted, query, list);
  const sections = useMemo(() => list.map((b) => ({ key: b.timeBucket, count: b.count, assets: byMonth.get(b.timeBucket)?.assets })), [list, byMonth]);
  if (buckets.isError) return <Message text={errorMessage(buckets.error)} />;
  return <Gallery kind={kind} sections={sections} loading={buckets.isLoading} empty={empty} onNear={onNear} header={header} />;
}

const Back = () => {
  const navigate = useNavigate();
  return <IconButton path={mdiArrowLeft} label="Back" onClick={() => navigate(-1)} />;
};

export function Photos() {
  const { user } = useAuth();
  const navigate = useNavigate();
  return (
    <>
      <header className="flex shrink-0 items-center gap-2 px-3 pt-[env(safe-area-inset-top)]">
        <img src="/app/favicon.svg" alt="" className="size-8" />
        <h1 className="flex-1 py-4 text-2xl font-semibold text-primary">Photos</h1>
        <UploadButton>
          <svg viewBox="0 0 24 24" width={26} height={26} fill="currentColor" aria-hidden="true">
            <path d={mdiCloudUploadOutline} />
          </svg>
        </UploadButton>
        <button type="button" aria-label="Account" onClick={() => navigate('/library')} className="flex size-10 items-center justify-center rounded-full bg-primary font-semibold text-on-primary">
          {user?.name?.charAt(0).toUpperCase()}
        </button>
      </header>
      <Timeline kind="library" query={{ order: 'desc', visibility: 'timeline', withStacked: true, withPartners: true }} empty="No photos yet. Tap the cloud to upload some." />
    </>
  );
}

export const Favorites = () => (
  <>
    <TopBar title="Favorites" left={<Back />} />
    <Timeline kind="favorites" query={{ order: 'desc', isFavorite: true }} empty="Photos you favorite appear here." />
  </>
);

export const Archive = () => (
  <>
    <TopBar title="Archive" left={<Back />} />
    <Timeline kind="archive" query={{ order: 'desc', visibility: 'archive' }} empty="Archived photos appear here." />
  </>
);

export const Bin = () => (
  <>
    <TopBar title="Bin" />
    <Timeline kind="bin" query={{ order: 'desc', isTrashed: true }} empty="The bin is empty." />
  </>
);

export function Album() {
  const { albumId = '' } = useParams();
  const album = useQuery({ queryKey: ['album', albumId], queryFn: () => getAlbum(albumId) });
  return (
    <>
      <TopBar title={album.data?.albumName ?? 'Album'} left={<Back />} />
      <Timeline key={albumId} kind="album" query={{ albumId, order: album.data?.order ?? 'desc' }} empty="This album is empty." />
    </>
  );
}
