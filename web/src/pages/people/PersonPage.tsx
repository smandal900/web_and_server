import { lazy, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  mdiAccountMultipleOutline,
  mdiArrowLeft,
  mdiCakeVariantOutline,
  mdiDeleteOutline,
  mdiDotsVertical,
  mdiEyeOffOutline,
  mdiFaceRecognition,
  mdiHeart,
  mdiHeartOutline,
  mdiMerge,
} from '@mdi/js';
import { useQuery } from '@tanstack/react-query';
import { personThumbnailUrl } from '../../api/assets';
import { deletePerson, getPerson, getPersonStatistics, updatePerson } from '../../api/library';
import { MAIN_ACTIONS } from '../../components/timeline/presets';
import { Timeline } from '../../components/timeline/Timeline';
import { Boundary } from '../../components/ui/Boundary';
import { IconButton } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { DateField } from '../../components/ui/Fields';
import { Menu } from '../../components/ui/Menu';
import { EmptyState } from '../../components/ui/Misc';
import { Modal } from '../../components/ui/Modal';
import { PageSpinner } from '../../components/ui/Spinner';
import { useRun } from '../../hooks/useRun';
import { t } from '../../i18n';
import { Button } from '../../components/ui/Button';

const MergeModal = lazy(() => import('../../components/modals/PeopleMergeModal'));

/** One person: a name you can edit, and every picture they appear in. */
export default function PersonPage() {
  const { personId = '' } = useParams();
  const navigate = useNavigate();
  const run = useRun();
  const person = useQuery({ queryKey: ['person', personId], queryFn: () => getPerson(personId), retry: false });
  const stats = useQuery({ queryKey: ['person', personId, 'stats'], queryFn: () => getPersonStatistics(personId), retry: false });
  const [name, setName] = useState('');
  const [modal, setModal] = useState<'merge' | 'birthday' | 'delete' | null>(null);
  const [birthday, setBirthday] = useState('');
  const p = person.data;
  useEffect(() => {
    if (p) {
      setName(p.name);
      setBirthday(p.birthDate?.slice(0, 10) ?? '');
    }
  }, [p?.id, p?.name, p?.birthDate]); // eslint-disable-line react-hooks/exhaustive-deps

  if (person.isLoading) return <PageSpinner />;
  if (!p) return <EmptyState icon={mdiAccountMultipleOutline} title={t('Person not available')} text={(person.error as Error)?.message} />;

  const refresh = [['person', p.id], ['people']];
  const saveName = () => name !== p.name && run(() => updatePerson(p.id, { name }), { success: t('Name saved'), invalidate: refresh });

  return (
    <div className="h-full">
      <Timeline
        query={{ personId: p.id, order: 'desc' }}
        base={`/people/${p.id}`}
        actions={MAIN_ACTIONS}
        customActions={[
          {
            id: 'feature',
            label: t('Use as person photo'),
            icon: mdiFaceRecognition,
            hidden: (sel) => sel.length !== 1,
            run: (ids) => run(() => updatePerson(p.id, { featureFaceAssetId: ids[0] }), { success: t('Person photo changed'), invalidate: refresh }),
          },
        ]}
        header={
          <header className="flex items-center gap-3 px-1 py-4">
            <IconButton path={mdiArrowLeft} label={t('Back')} onClick={() => navigate('/people')} />
            <img src={personThumbnailUrl(p.id)} alt="" className="size-16 rounded-full bg-panel object-cover" />
            <div className="min-w-0 flex-1">
              <input value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} placeholder={t('Add a name')} aria-label={t('Name')} className="w-full rounded-lg bg-transparent px-2 py-1 text-2xl font-semibold outline-none hover:bg-panel focus:bg-panel" />
              <p className="px-2 text-sm text-muted">{stats.data ? t('{count} items', { count: stats.data.assets }) : ''}</p>
            </div>
            <IconButton path={p.isFavorite ? mdiHeart : mdiHeartOutline} label={t('Favorite')} onClick={() => run(() => updatePerson(p.id, { isFavorite: !p.isFavorite }), { invalidate: refresh })} />
            <Menu
              trigger={({ toggle }) => <IconButton path={mdiDotsVertical} label={t('More')} onClick={toggle} />}
              items={[
                { label: t('Set birthday'), icon: mdiCakeVariantOutline, onClick: () => setModal('birthday') },
                { label: t('Merge people'), icon: mdiMerge, onClick: () => setModal('merge') },
                { label: t('Hide person'), icon: mdiEyeOffOutline, onClick: () => run(() => updatePerson(p.id, { isHidden: true }), { success: t('Person hidden'), invalidate: refresh }).then((r) => r.ok && navigate('/people')) },
                { label: t('Delete person'), icon: mdiDeleteOutline, danger: true, divider: true, onClick: () => setModal('delete') },
              ]}
            />
          </header>
        }
        empty={<EmptyState icon={mdiAccountMultipleOutline} title={t('No photos of this person')} />}
      />
      <Boundary compact fallback={null}>
        {modal === 'merge' && <MergeModal person={p} onClose={() => setModal(null)} />}
      </Boundary>
      {modal === 'birthday' && (
        <Modal
          title={t('Set birthday')}
          size="sm"
          onClose={() => setModal(null)}
          footer={
            <>
              <Button variant="outline" onClick={() => setModal(null)}>
                {t('Cancel')}
              </Button>
              <Button
                onClick={async () => {
                  const r = await run(() => updatePerson(p.id, { birthDate: birthday || null }), { success: t('Birthday saved'), invalidate: refresh });
                  if (r.ok) setModal(null);
                }}
              >
                {t('Save')}
              </Button>
            </>
          }
        >
          <DateField label={t('Birthday')} value={birthday} max={new Date().toISOString().slice(0, 10)} onChange={setBirthday} />
        </Modal>
      )}
      {modal === 'delete' && (
        <ConfirmDialog
          title={t('Delete person?')}
          message={t('"{name}" is removed. The photos themselves stay.', { name: p.name || t('This person') })}
          confirmText="Delete"
          danger
          onClose={() => setModal(null)}
          onConfirm={() => run(() => deletePerson(p.id), { success: t('Person deleted'), invalidate: [['people']] }).then((r) => r.ok && navigate('/people'))}
        />
      )}
    </div>
  );
}
