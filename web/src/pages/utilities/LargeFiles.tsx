import { useState } from 'react';
import { mdiPackageVariantClosed } from '@mdi/js';
import { useQuery } from '@tanstack/react-query';
import { deleteAssets, thumbnailUrl } from '../../api/assets';
import { getLargeAssets } from '../../api/library';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Checkbox, Select } from '../../components/ui/Fields';
import { EmptyState } from '../../components/ui/Misc';
import { PageBody, PageHeader } from '../../components/ui/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { Row, Table } from '../../components/ui/Table';
import { useRun } from '../../hooks/useRun';
import { t } from '../../i18n';
import { formatBytes, formatDate } from '../../lib/format';

const MB = 1024 * 1024;
const SIZES = [10, 50, 100, 500, 1024];

/** The biggest files first. Pick some and move them to the trash to free space. */
export default function LargeFiles() {
  const run = useRun();
  const [minMb, setMinMb] = useState(50);
  const [chosen, setChosen] = useState<string[]>([]);
  const [confirm, setConfirm] = useState(false);
  const list = useQuery({ queryKey: ['large-files', minMb], queryFn: () => getLargeAssets(minMb * MB), retry: false });
  const assets = [...(list.data ?? [])].sort((a, b) => (b.exifInfo?.fileSizeInByte ?? 0) - (a.exifInfo?.fileSizeInByte ?? 0));
  const flip = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const total = assets.filter((a) => chosen.includes(a.id)).reduce((s, a) => s + (a.exifInfo?.fileSizeInByte ?? 0), 0);

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t('Large files')}>
        <Button variant="danger-outline" disabled={chosen.length === 0} onClick={() => setConfirm(true)}>
          {t('Delete {count} ({size})', { count: chosen.length, size: formatBytes(total) })}
        </Button>
      </PageHeader>
      <PageBody>
        <div className="mb-4 max-w-xs">
          <Select label={t('Larger than')} value={minMb} onChange={(v) => setMinMb(Number(v))} options={SIZES.map((s) => ({ value: s, label: s >= 1024 ? `${s / 1024} GiB` : `${s} MiB` }))} />
        </div>
        {list.isLoading && <PageSpinner />}
        {list.isError && <EmptyState icon={mdiPackageVariantClosed} title={t('Not available')} text={(list.error as Error).message} />}
        {!list.isLoading && !list.isError && assets.length === 0 && <EmptyState icon={mdiPackageVariantClosed} title={t('No files this large')} />}
        {assets.length > 0 && (
          <Table head={['', '', t('Name'), t('Size'), t('Date')]}>
            {assets.map((a) => (
              <Row
                key={a.id}
                cells={[
                  <Checkbox key="c" label="" checked={chosen.includes(a.id)} onChange={() => flip(a.id)} />,
                  <img key="i" src={thumbnailUrl(a.id)} alt="" className="size-12 rounded-lg object-cover" />,
                  a.originalFileName,
                  <span key="s" className="font-medium">{formatBytes(a.exifInfo?.fileSizeInByte)}</span>,
                  formatDate(a.fileCreatedAt),
                ]}
              />
            ))}
          </Table>
        )}
      </PageBody>
      {confirm && (
        <ConfirmDialog
          title={t('Delete {count} files?', { count: chosen.length })}
          message={t('They are moved to the trash and free {size} once it is emptied.', { size: formatBytes(total) })}
          confirmText="Delete"
          danger
          onClose={() => setConfirm(false)}
          onConfirm={async () => {
            const r = await run(() => deleteAssets(chosen, false), { success: t('Moved to trash'), invalidate: [['large-files'], ['timeline']] });
            if (r.ok) setChosen([]);
          }}
        />
      )}
    </div>
  );
}
