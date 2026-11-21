import { useQuery } from '@tanstack/react-query';
import { getServerStatistics, getVersionHistory } from '../../api/core';
import { Card } from '../../components/ui/Misc';
import { PageBody, PageHeader } from '../../components/ui/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { Row, Table } from '../../components/ui/Table';
import { useAbout, useStorage } from '../../hooks/useServer';
import { t } from '../../i18n';
import { formatBytes, formatDateTime, formatNumber } from '../../lib/format';

export default function ServerStatus() {
  const storage = useStorage().data;
  const about = useAbout().data;
  const stats = useQuery({ queryKey: ['server-statistics'], queryFn: getServerStatistics });
  const history = useQuery({ queryKey: ['version-history'], queryFn: getVersionHistory });
  const s = stats.data;

  const tile = (label: string, value: string) => (
    <div className="rounded-xl bg-panel p-4 text-center">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t('Server status')} />
      <PageBody>
        {stats.isLoading && <PageSpinner />}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title={t('Server')}>
            <dl className="grid grid-cols-2 gap-1 text-sm">
              <dt className="text-muted">{t('Version')}</dt>
              <dd>{about?.version ?? '-'}</dd>
              <dt className="text-muted">Node.js</dt>
              <dd>{about?.nodejs ?? '-'}</dd>
              <dt className="text-muted">{t('License')}</dt>
              <dd>{about?.licensed ? t('Licensed') : t('None needed')}</dd>
            </dl>
          </Card>
          <Card title={t('Disk')}>
            {storage && (
              <>
                <div className="mb-1 flex justify-between text-sm">
                  <span>
                    {storage.diskUse} {t('of')} {storage.diskSize}
                  </span>
                  <span>{storage.diskUsagePercentage}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded bg-panel">
                  <div className={storage.diskUsagePercentage > 90 ? 'h-full bg-danger' : 'h-full bg-primary'} style={{ width: `${Math.min(100, storage.diskUsagePercentage)}%` }} />
                </div>
                <p className="mt-2 text-xs text-muted">{t('{size} free', { size: storage.diskAvailable })}</p>
              </>
            )}
          </Card>
          {s && (
            <Card title={t('Library')} className="lg:col-span-2">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {tile(t('Photos'), formatNumber(s.photos))}
                {tile(t('Videos'), formatNumber(s.videos))}
                {tile(t('Photo storage'), formatBytes(s.usagePhotos))}
                {tile(t('Video storage'), formatBytes(s.usageVideos))}
              </div>
              <div className="mt-4">
                <Table head={[t('User'), t('Photos'), t('Videos'), t('Usage'), t('Quota')]}>
                  {s.usageByUser.map((u) => (
                    <Row key={u.userId} cells={[u.userName, formatNumber(u.photos), formatNumber(u.videos), formatBytes(u.usage), u.quotaSizeInBytes ? formatBytes(u.quotaSizeInBytes) : t('Unlimited')]} />
                  ))}
                </Table>
              </div>
            </Card>
          )}
          <Card title={t('Version history')} className="lg:col-span-2">
            <ul className="divide-y divide-line text-sm">
              {(history.data ?? []).map((v) => (
                <li key={v.id} className="flex justify-between py-2">
                  <span className="font-mono">{v.version}</span>
                  <span className="text-muted">{formatDateTime(v.createdAt)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </PageBody>
    </div>
  );
}
