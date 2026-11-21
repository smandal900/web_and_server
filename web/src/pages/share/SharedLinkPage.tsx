// Public pages: /s/<slug> and /share/<key>. No login needed; the link itself is the permission.
import { lazy, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { mdiAlertCircleOutline, mdiDownload, mdiLockOutline } from '@mdi/js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../../api/client';
import { getMySharedLink, loginToSharedLink } from '../../api/library';
import { AssetListView } from '../../components/timeline/AssetListView';
import { READONLY_ACTIONS } from '../../components/timeline/presets';
import { UploadButton } from '../../components/upload/UploadButton';
import { Boundary } from '../../components/ui/Boundary';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Fields';
import { EmptyState, Logo } from '../../components/ui/Misc';
import { PageSpinner } from '../../components/ui/Spinner';
import { useRun } from '../../hooks/useRun';
import { t } from '../../i18n';
import { downloadAssets } from '../../lib/download';
import { UploadProvider } from '../../state/UploadProvider';
import { useAuth } from '../../state/AuthProvider';

const UploadPanel = lazy(() => import('../../components/upload/UploadPanel'));
const AssetViewer = lazy(() => import('../../components/viewer/AssetViewer'));

function PasswordPrompt({ onSubmit, error }: { onSubmit: (password: string) => void; error?: string }) {
  const [password, setPassword] = useState('');
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSubmit(password);
      }}
      className="mx-auto flex max-w-sm flex-col items-center gap-4 p-8"
    >
      <EmptyState icon={mdiLockOutline} title={t('This link is password protected')} />
      <TextField label={t('Password')} type="password" value={password} onChange={setPassword} autoFocus />
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit">{t('Open')}</Button>
    </form>
  );
}

export default function SharedLinkPage() {
  const { key, slug } = useParams();
  const { user } = useAuth();
  const run = useRun();
  const qc = useQueryClient();
  const [passwordError, setPasswordError] = useState('');
  const identity = useMemo(() => (slug ? { slug } : { key }), [slug, key]);
  const base = slug ? `/s/${slug}` : `/share/${key}`;

  const link = useQuery({ queryKey: ['shared-link-public', identity], queryFn: () => getMySharedLink(identity), retry: false });

  if (link.isLoading) return <PageSpinner />;

  const error = link.error as ApiError | null;
  if (error) {
    const needsPassword = error.status === 401 && /password/i.test(error.message);
    if (needsPassword) {
      return (
        <PasswordPrompt
          error={passwordError}
          onSubmit={async (password) => {
            const r = await run(() => loginToSharedLink({ password, ...identity }), { quiet: true });
            if (!r.ok) return setPasswordError(t('Wrong password'));
            setPasswordError('');
            qc.invalidateQueries({ queryKey: ['shared-link-public'] });
          }}
        />
      );
    }
    return (
      <EmptyState icon={mdiAlertCircleOutline} title={t('This link does not work')} text={t('It may have expired, been deleted, or the address is wrong.')}>
        <Link to="/">
          <Button variant="outline">{t('Go to the app')}</Button>
        </Link>
      </EmptyState>
    );
  }

  const data = link.data!;
  const assets = data.album?.assets ?? data.assets;
  const shareKey = data.key;
  const title = data.album?.albumName ?? data.description ?? t('Shared photos');

  // One picture shared on its own: show it straight away.
  if (data.type === 'INDIVIDUAL' && assets.length === 1) {
    return (
      <Boundary>
        <AssetViewer assetId={assets[0].id} assetIds={[assets[0].id]} onShow={() => undefined} onClose={() => location.assign('/')} actions={data.allowDownload ? ['download'] : []} shareKey={shareKey} readOnly />
      </Boundary>
    );
  }

  return (
    <UploadProvider shareKey={shareKey}>
      <div className="flex h-full flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line px-4">
          <Logo />
          <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h1>
          {data.allowUpload && <UploadButton compact />}
          {data.allowDownload && (
            <Button variant="outline" icon={mdiDownload} onClick={() => run(() => downloadAssets(assets.map((a) => a.id), shareKey))}>
              <span className="max-md:hidden">{t('Download all')}</span>
            </Button>
          )}
          {!user && (
            <Link to="/auth/login">
              <Button variant="ghost">{t('Sign in')}</Button>
            </Link>
          )}
        </header>
        <div className="min-h-0 flex-1">
          <AssetListView
            assets={assets}
            base={base}
            actions={data.allowDownload ? READONLY_ACTIONS : []}
            shareKey={shareKey}
            readOnly
            selectable={data.allowDownload}
            header={data.album?.description ? <p className="px-1 py-3 text-sm text-muted">{data.album.description}</p> : undefined}
          />
        </div>
        <Boundary compact fallback={null}>
          <UploadPanel />
        </Boundary>
      </div>
    </UploadProvider>
  );
}
