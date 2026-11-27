// Search, Albums, Library and the sign-in screen.
import { useMemo, useState, useSyncExternalStore, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  mdiArchiveArrowDownOutline,
  mdiCellphoneArrowDown,
  mdiCloudUploadOutline,
  mdiHeartOutline,
  mdiImageAlbum,
  mdiImageMultipleOutline,
  mdiLayersOutline,
  mdiLogout,
  mdiMagnify,
  mdiOpenInNew,
} from '@mdi/js';
import { thumbnailUrl } from '@web/api/assets';
import { errorMessage } from '@web/api/client';
import { getAlbums, searchAssets } from '@web/api/library';
import type { Asset, TimelineAsset } from '@web/api/types';
import { Icon } from '@web/components/ui/Icon';
import { useFeatures } from '@web/hooks/useServer';
import { toRequest } from '@web/lib/search';
import { useAuth } from '@web/state/AuthProvider';
import { Gallery } from '../components/Gallery';
import { Message, Row, Spinner, TopBar } from '../components/ui';
import { UploadButton } from '../components/Upload';
import { setSimilar, similarOn } from '../prefs';
import { canInstall, clearPrivateCaches, install, installOffered, isInstalled, subscribeInstall } from '../pwa';

/** A search result in the shape the grid uses. */
const toGrid = (a: Asset): TimelineAsset => ({
  id: a.id,
  ownerId: a.ownerId,
  fileCreatedAt: a.localDateTime ?? a.fileCreatedAt,
  localOffsetHours: 0,
  ratio: 1,
  thumbhash: a.thumbhash,
  isImage: a.type !== 'VIDEO',
  isFavorite: a.isFavorite,
  isTrashed: a.isTrashed,
  duration: a.duration,
  livePhotoVideoId: a.livePhotoVideoId ?? null,
  projectionType: null,
  visibility: a.visibility,
  stack: null,
});

export function Search() {
  const [params, setParams] = useSearchParams();
  const text = params.get('q') ?? '';
  const [typed, setTyped] = useState(text);
  const smart = useFeatures().data?.smartSearch;
  const results = useQuery({
    queryKey: ['search', text, smart],
    enabled: !!text,
    queryFn: () => {
      const request = toRequest({ text, mode: smart ? 'smart' : 'filename' });
      return searchAssets({ ...request.body, size: 200 }, request.smart);
    },
  });
  const assets = useMemo(() => (results.data?.assets.items ?? []).map(toGrid), [results.data]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    (document.activeElement as HTMLElement | null)?.blur();
    setParams(typed.trim() ? { q: typed.trim() } : {}, { replace: true });
  };
  return (
    <>
      <form onSubmit={submit} className="flex shrink-0 items-center gap-2 px-3 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-2" role="search">
        <label className="flex flex-1 items-center gap-3 rounded-full bg-panel px-4">
          <Icon path={mdiMagnify} />
          <input type="search" enterKeyHint="search" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={smart ? 'Search your photos' : 'Search by file name'} className="min-w-0 flex-1 bg-transparent py-3.5 text-base outline-none" />
        </label>
      </form>
      {!text ? (
        <Message icon={mdiMagnify} text={smart ? 'Describe what you are looking for.' : 'Type part of a file name, such as a date: 20230126.'} />
      ) : results.isError ? (
        <Message text={errorMessage(results.error)} />
      ) : (
        <Gallery kind="search" months={false} loading={results.isLoading} empty="Nothing found." sections={assets.length ? [{ key: 'results', count: assets.length, assets }] : []} />
      )}
    </>
  );
}

export function Albums() {
  const albums = useQuery({ queryKey: ['albums'], queryFn: () => getAlbums() });
  return (
    <>
      <TopBar title="Albums" />
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {albums.isLoading && <Spinner />}
        {albums.isError && <Message text={errorMessage(albums.error)} />}
        {albums.data?.length === 0 && <Message icon={mdiImageAlbum} text="No albums yet. Select photos and add them to a new album." />}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {(albums.data ?? []).map((album) => (
            <Link key={album.id} to={`/albums/${album.id}`}>
              <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-panel text-muted">
                {album.albumThumbnailAssetId ? <img src={thumbnailUrl(album.albumThumbnailAssetId)} alt="" loading="lazy" className="size-full object-cover" /> : <Icon path={mdiImageAlbum} size={40} />}
              </div>
              <p className="mt-2 truncate text-sm font-medium">{album.albumName}</p>
              <p className="text-xs text-muted">{album.assetCount} items</p>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}

export function Library() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [grouped, setGrouped] = useState(similarOn);
  const offered = useSyncExternalStore(subscribeInstall, installOffered);
  const shortcut = (to: string, icon: string, label: string) => (
    <Link to={to} className="flex items-center gap-3 rounded-full bg-panel px-5 py-3.5 text-sm font-medium">
      <Icon path={icon} />
      {label}
    </Link>
  );
  return (
    <>
      <TopBar title="Library" />
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <p className="px-2 pb-3 text-sm text-muted">
          {user?.name} · {user?.email}
        </p>
        <div className="grid grid-cols-2 gap-3">
          {shortcut('/favorites', mdiHeartOutline, 'Favorites')}
          {shortcut('/archive', mdiArchiveArrowDownOutline, 'Archive')}
        </div>
        <div className="mt-4">
          <UploadButton className="flex w-full items-center gap-4 px-2 py-3.5 text-sm font-medium">
            <Icon path={mdiCloudUploadOutline} />
            Upload photos and videos
          </UploadButton>
          <Row
            icon={mdiLayersOutline}
            label="Group similar photos"
            onClick={() => {
              setSimilar(!grouped);
              setGrouped(!grouped);
            }}
          >
            <span role="switch" aria-checked={grouped} className={`flex h-6 w-11 items-center rounded-full p-0.5 ${grouped ? 'justify-end bg-primary' : 'justify-start bg-line'}`}>
              <span className="size-5 rounded-full bg-white" />
            </span>
          </Row>
          {offered && <Row icon={mdiCellphoneArrowDown} label="Install app" onClick={() => void install()} />}
          {/* the web app has the rest: people, places, map, sharing, settings, administration */}
          <a href="/photos" className="flex items-center gap-4 px-2 py-3.5 text-sm font-medium">
            <Icon path={mdiImageMultipleOutline} />
            <span className="flex-1">Open the full web app</span>
            <Icon path={mdiOpenInNew} size={18} />
          </a>
          <Row
            icon={mdiLogout}
            label="Sign out"
            onClick={async () => {
              await clearPrivateCaches(true);
              await logout();
              navigate('/');
            }}
          />
        </div>
        {!isInstalled() && !offered && (
          <p className="mt-4 px-2 text-xs text-muted">
            {canInstall() ? 'To install, use “Add to Home screen” or “Install app” in the browser menu.' : 'To install this as an app, open it with an https address.'}
          </p>
        )}
      </div>
    </>
  );
}

export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await clearPrivateCaches(); // pictures cached for whoever used this phone before
      await login(email.trim(), password);
    } catch (failure) {
      setError(errorMessage(failure));
      setBusy(false);
    }
  };
  const field = 'w-full rounded-xl border border-line bg-transparent px-4 py-3.5 text-base outline-none focus:border-primary';
  return (
    <form onSubmit={submit} className="mx-auto flex h-full max-w-sm flex-col justify-center gap-4 px-8">
      <img src="/app/favicon.svg" alt="" className="mx-auto size-20" />
      <h1 className="text-center text-3xl">Photos</h1>
      <p className="text-center text-sm text-muted">Sign in to your server</p>
      <input type="email" required autoComplete="username" placeholder="Email" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
      <input type="password" required autoComplete="current-password" placeholder="Password" aria-label="Password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
      {error && <p className="text-center text-sm text-danger">{error}</p>}
      <button type="submit" disabled={busy} className="rounded-full bg-primary py-3.5 font-medium text-on-primary">
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
