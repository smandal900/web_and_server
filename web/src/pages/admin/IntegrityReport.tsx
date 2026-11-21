import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { mdiCheckCircleOutline } from '@mdi/js';
import { useQuery } from '@tanstack/react-query';
import { deleteIntegrityItems, getIntegrityReport } from '../../api/admin';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Fields';
import { EmptyState } from '../../components/ui/Misc';
import { PageBody, PageHeader } from '../../components/ui/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { Row, Table } from '../../components/ui/Table';
import { useRun } from '../../hooks/useRun';
import { t } from '../../i18n';
import { formatDateTime } from '../../lib/format';

/** The files behind one integrity problem type, with the option to remove the records. */
export default function IntegrityReport() {
  const { type = '' } = useParams();
  const navigate = useNavigate();
  const run = useRun();
  const [chosen, setChosen] = useState<string[]>([]);
  const report = useQuery({ queryKey: ['integrity-report', type], queryFn: () => getIntegrityReport(type), retry: false });
  const items = report.data?.items ?? [];

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={type.replace(/_/g, ' ')}>
        <Button variant="outline" onClick={() => navigate('/admin/maintenance')}>
          {t('Back')}
        </Button>
        <Button variant="danger-outline" disabled={chosen.length === 0} onClick={() => run(() => deleteIntegrityItems(type, chosen), { success: t('Removed'), invalidate: [['integrity-report', type], ['integrity']] }).then(() => setChosen([]))}>
          {t('Remove {count}', { count: chosen.length })}
        </Button>
      </PageHeader>
      <PageBody>
        {report.isLoading && <PageSpinner />}
        {report.isError && <EmptyState icon={mdiCheckCircleOutline} title={t('Report not available')} text={(report.error as Error).message} />}
        {!report.isLoading && !report.isError && items.length === 0 && <EmptyState icon={mdiCheckCircleOutline} title={t('Nothing to report')} />}
        {items.length > 0 && (
          <Table head={['', t('Path'), t('Found')]}>
            {items.map((i) => (
              <Row key={i.id} cells={[<Checkbox key="c" label="" checked={chosen.includes(i.id)} onChange={(on) => setChosen(on ? [...chosen, i.id] : chosen.filter((x) => x !== i.id))} />, <code key="p" className="text-xs break-all">{i.path}</code>, formatDateTime(i.createdAt)]} />
            ))}
          </Table>
        )}
      </PageBody>
    </div>
  );
}
