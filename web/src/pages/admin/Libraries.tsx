import { useState } from 'react';
import { Link } from 'react-router';
import { mdiDeleteOutline, mdiLibraryShelves, mdiPencilOutline, mdiPlus, mdiSync } from '@mdi/js';
import { useQuery } from '@tanstack/react-query';
import { deleteLibrary, getLibraries, scanLibrary } from '../../api/admin';
import type { Library } from '../../api/types';
import { Button, IconButton } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/Misc';
import { PageBody, PageHeader } from '../../components/ui/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { Row, Table } from '../../components/ui/Table';
import { useRun } from '../../hooks/useRun';
import { t } from '../../i18n';
import { formatDateTime } from '../../lib/format';

/** External libraries: folders on the server that are scanned for pictures instead of uploaded. */
export default function Libraries() {
  const run = useRun();
  const list = useQuery({ queryKey: ['libraries'], queryFn: getLibraries });
  const [deleting, setDeleting] = useState<Library | null>(null);
  const items = list.data ?? [];

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t('Libraries')}>
        <Link to="/admin/library-management/new">
          <Button icon={mdiPlus}>{t('Create library')}</Button>
        </Link>
      </PageHeader>
      <PageBody>
        {list.isLoading && <PageSpinner />}
        {!list.isLoading && items.length === 0 && <EmptyState icon={mdiLibraryShelves} title={t('No external libraries')} text={t('Add a library to include pictures that already live in a folder on the server.')} />}
        {items.length > 0 && (
          <Table head={[t('Name'), t('Folders'), t('Pictures'), t('Last scan'), '']}>
            {items.map((l) => (
              <Row
                key={l.id}
                cells={[
                  <Link key="n" to={`/admin/library-management/${l.id}`} className="font-medium hover:underline">{l.name}</Link>,
                  l.importPaths.length,
                  l.assetCount ?? '-',
                  l.refreshedAt ? formatDateTime(l.refreshedAt) : t('Never'),
                  <div key="a" className="flex justify-end">
                    <IconButton path={mdiSync} label={t('Scan')} size={20} onClick={() => run(() => scanLibrary(l.id), { success: t('Scan started'), invalidate: [['libraries']] })} />
                    <Link to={`/admin/library-management/${l.id}/edit`}>
                      <IconButton path={mdiPencilOutline} label={t('Edit')} size={20} />
                    </Link>
                    <IconButton path={mdiDeleteOutline} label={t('Delete')} size={20} onClick={() => setDeleting(l)} />
                  </div>,
                ]}
              />
            ))}
          </Table>
        )}
      </PageBody>
      {deleting && <ConfirmDialog title={t('Delete library?')} message={t('"{name}" and the pictures that came from it are removed from the app. The files on disk are not touched.', { name: deleting.name })} confirmText="Delete" danger onClose={() => setDeleting(null)} onConfirm={() => run(() => deleteLibrary(deleting.id), { success: t('Library deleted'), invalidate: [['libraries']] })} />}
    </div>
  );
}
