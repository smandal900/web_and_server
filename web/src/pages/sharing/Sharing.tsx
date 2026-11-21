import { useState } from 'react';
import { Link } from 'react-router';
import { mdiAccountPlusOutline, mdiImageAlbum, mdiLinkVariant, mdiShareVariantOutline } from '@mdi/js';
import { useQuery } from '@tanstack/react-query';
import { getGroupUsers } from '../../api/core';
import { addPartner, getAlbums, getPartners, removePartner, updatePartner } from '../../api/library';
import { AlbumCard } from '../../components/albums/AlbumCard';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Select, Switch } from '../../components/ui/Fields';
import { Icon } from '../../components/ui/Icon';
import { Avatar, Card, EmptyState } from '../../components/ui/Misc';
import { Modal } from '../../components/ui/Modal';
import { PageBody, PageHeader } from '../../components/ui/PageHeader';
import { useRun } from '../../hooks/useRun';
import { t } from '../../i18n';
import { useAuth } from '../../state/AuthProvider';

/** Everything about sharing in one place: partners, shared albums, and a link to the shared-links list. */
export default function Sharing() {
  const { user } = useAuth();
  const run = useRun();
  const sharedBy = useQuery({ queryKey: ['partners', 'shared-by'], queryFn: () => getPartners('shared-by'), retry: false });
  const sharedWith = useQuery({ queryKey: ['partners', 'shared-with'], queryFn: () => getPartners('shared-with'), retry: false });
  const albums = useQuery({ queryKey: ['albums'], queryFn: () => getAlbums(), retry: false });
  const group = useQuery({ queryKey: ['group-users', user?.clusterGroupId], queryFn: () => getGroupUsers(user!.clusterGroupId!), enabled: !!user?.clusterGroupId, retry: false });
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);

  const mine = sharedBy.data ?? []; // partners I share my library with
  const theirs = sharedWith.data ?? []; // partners who share theirs with me
  const sharedAlbums = (albums.data ?? []).filter((a) => a.shared);
  const candidates = (group.data ?? []).filter((u) => u.id !== user?.id && !mine.some((p) => p.id === u.id));
  const refresh = [['partners', 'shared-by'], ['partners', 'shared-with']];

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t('Sharing')}>
        <Link to="/sharing/sharedlinks">
          <Button variant="ghost" icon={mdiLinkVariant}>
            <span className="max-md:hidden">{t('Shared links')}</span>
          </Button>
        </Link>
      </PageHeader>
      <PageBody>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card
            title={t('Partners')}
            actions={
              <Button size="sm" variant="outline" icon={mdiAccountPlusOutline} onClick={() => setAdding(true)}>
                {t('Add partner')}
              </Button>
            }
          >
            <p className="mb-3 text-sm text-muted">{t('A partner can see your whole library. You can see theirs when they share it with you.')}</p>
            <h4 className="mb-1 text-xs font-semibold text-primary uppercase">{t('You share with')}</h4>
            {mine.length === 0 && <p className="mb-3 text-sm text-muted">{t('Nobody yet.')}</p>}
            <ul className="mb-4 divide-y divide-line">
              {mine.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2">
                  <Avatar user={p} size={36} />
                  <span className="flex-1 text-sm">
                    {p.name}
                    <span className="block text-xs text-muted">{p.email}</span>
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => setRemoving(p.id)}>
                    {t('Stop sharing')}
                  </Button>
                </li>
              ))}
            </ul>
            <h4 className="mb-1 text-xs font-semibold text-primary uppercase">{t('Shared with you')}</h4>
            {theirs.length === 0 && <p className="text-sm text-muted">{t('Nobody yet.')}</p>}
            <ul className="divide-y divide-line">
              {theirs.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2">
                  <Avatar user={p} size={36} />
                  <Link to={`/partners/${p.id}`} className="flex-1 text-sm hover:underline">
                    {p.name}
                    <span className="block text-xs text-muted">{p.email}</span>
                  </Link>
                  <Switch label={t('Show in my timeline')} checked={!!p.inTimeline} onChange={(v) => run(() => updatePartner(p.id, v), { invalidate: refresh })} />
                </li>
              ))}
            </ul>
          </Card>

          <Card title={t('Shared albums')} actions={<Link to="/albums" className="text-sm text-primary">{t('All albums')}</Link>}>
            {sharedAlbums.length === 0 ? (
              <EmptyState icon={mdiImageAlbum} title={t('No shared albums')} text={t('Share an album from its page and it shows up here.')} />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {sharedAlbums.map((a) => (
                  <AlbumCard key={a.id} album={a} mine={a.owner.id === user?.id} />
                ))}
              </div>
            )}
          </Card>
        </div>
        <p className="mt-6 flex items-center gap-2 text-sm text-muted">
          <Icon path={mdiShareVariantOutline} size={18} />
          {t('Want to give someone without an account access? Create a shared link from an album or a selection of photos.')}
        </p>
      </PageBody>

      {adding && (
        <Modal
          title={t('Add partner')}
          size="sm"
          onClose={() => setAdding(false)}
          footer={
            <>
              <Button variant="outline" onClick={() => setAdding(false)}>
                {t('Cancel')}
              </Button>
              <Button
                disabled={!picked}
                onClick={async () => {
                  const r = await run(() => addPartner(picked), { success: t('Partner added'), invalidate: refresh });
                  if (r.ok) (setAdding(false), setPicked(''));
                }}
              >
                {t('Add')}
              </Button>
            </>
          }
        >
          <Select label={t('Person')} value={picked} onChange={setPicked} options={[{ value: '', label: t('Choose a person') }, ...candidates.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }))]} />
        </Modal>
      )}
      {removing && (
        <ConfirmDialog
          title={t('Stop sharing?')}
          message={t('This person will no longer see your photos.')}
          confirmText="Stop sharing"
          danger
          onClose={() => setRemoving(null)}
          onConfirm={() => run(() => removePartner(removing), { success: t('Sharing stopped'), invalidate: refresh })}
        />
      )}
    </div>
  );
}

