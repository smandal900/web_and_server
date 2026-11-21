import { useState } from 'react';
import { mdiContentDuplicate } from '@mdi/js';
import { useQuery } from '@tanstack/react-query';
import { thumbnailUrl } from '../../api/assets';
import { dismissDuplicate, getDuplicates, resolveDuplicates, type DuplicateGroup } from '../../api/library';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/Misc';
import { PageBody, PageHeader } from '../../components/ui/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { useRun } from '../../hooks/useRun';
import { t } from '../../i18n';
import { cx } from '../../lib/cx';
import { formatBytes, formatDate } from '../../lib/format';

/** The asset to keep by default: the biggest file, i.e. the best quality. */
const best = (g: DuplicateGroup) => [...g.assets].sort((a, b) => (b.exifInfo?.fileSizeInByte ?? 0) - (a.exifInfo?.fileSizeInByte ?? 0))[0].id;

function Group({ group, onDone }: { group: DuplicateGroup; onDone: () => void }) {
  const run = useRun();
  const [keep, setKeep] = useState<string[]>([best(group)]);
  const flip = (id: string) => setKeep((k) => (k.includes(id) ? k.filter((x) => x !== id) : [...k, id]));

  const resolve = async () => {
    const trashAssetIds = group.assets.map((a) => a.id).filter((id) => !keep.includes(id));
    const r = await run(() => resolveDuplicates([{ duplicateId: group.duplicateId, keepAssetIds: keep, trashAssetIds }]), { success: t('Duplicates resolved'), invalidate: [['timeline']] });
    if (r.ok) onDone();
  };
  const dismiss = async () => {
    const r = await run(() => dismissDuplicate(group.duplicateId), { success: t('Marked as not duplicates') });
    if (r.ok) onDone();
  };

  return (
    <section className="rounded-2xl border border-line bg-panel-2 p-4">
      <div className="flex gap-3 overflow-x-auto pb-3">
        {group.assets.map((a) => {
          const on = keep.includes(a.id);
          return (
            <button key={a.id} onClick={() => flip(a.id)} className={cx('w-48 shrink-0 overflow-hidden rounded-xl border-2 text-left', on ? 'border-primary' : 'border-transparent opacity-60')} aria-pressed={on}>
              <img src={thumbnailUrl(a.id, 'preview')} alt="" className="aspect-square w-full object-cover" />
              <div className="p-2 text-xs">
                <p className="truncate font-medium">{a.originalFileName}</p>
                <p className="text-muted">
                  {a.width} × {a.height} · {formatBytes(a.exifInfo?.fileSizeInByte)}
                </p>
                <p className="text-muted">{formatDate(a.fileCreatedAt)}</p>
                <p className={on ? 'font-medium text-primary' : 'text-danger'}>{on ? t('Keep') : t('Move to trash')}</p>
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={dismiss}>
          {t('Not duplicates')}
        </Button>
        <Button size="sm" disabled={keep.length === 0} onClick={resolve}>
          {t('Keep selected, trash the rest')}
        </Button>
      </div>
    </section>
  );
}

export default function Duplicates() {
  const run = useRun();
  const list = useQuery({ queryKey: ['duplicates'], queryFn: getDuplicates, retry: false });
  const groups = list.data ?? [];

  const resolveAll = () =>
    run(() => resolveDuplicates(groups.map((g) => ({ duplicateId: g.duplicateId, keepAssetIds: [best(g)], trashAssetIds: g.assets.map((a) => a.id).filter((id) => id !== best(g)) }))), {
      success: t('All duplicates resolved'),
      invalidate: [['duplicates'], ['timeline']],
    });

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t('Review duplicates')}>
        {groups.length > 0 && (
          <Button variant="outline" onClick={resolveAll}>
            {t('Keep the largest of each')}
          </Button>
        )}
      </PageHeader>
      <PageBody>
        {list.isLoading && <PageSpinner />}
        {list.isError && <EmptyState icon={mdiContentDuplicate} title={t('Duplicates are not available')} text={(list.error as Error).message} />}
        {!list.isLoading && !list.isError && groups.length === 0 && <EmptyState icon={mdiContentDuplicate} title={t('No duplicates found')} />}
        <div className="grid gap-4">
          {groups.map((g) => (
            <Group key={g.duplicateId} group={g} onDone={() => list.refetch()} />
          ))}
        </div>
      </PageBody>
    </div>
  );
}
