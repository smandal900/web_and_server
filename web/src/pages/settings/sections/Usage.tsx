import { useQuery } from '@tanstack/react-query';
import { getAssetStatistics } from '../../../api/assets';
import { getHeatmap } from '../../../api/core';
import { CalendarHeatmap } from '../../../components/ui/CalendarHeatmap';
import { useStorage } from '../../../hooks/useServer';
import { t } from '../../../i18n';
import { formatBytes, formatNumber } from '../../../lib/format';
import { useAuth } from '../../../state/AuthProvider';

export default function Usage() {
  const { user } = useAuth();
  const stats = useQuery({ queryKey: ['asset-statistics'], queryFn: () => getAssetStatistics() });
  const storage = useStorage().data;
  const heatmap = useQuery({
    queryKey: ['heatmap'],
    queryFn: () => getHeatmap(new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10), new Date().toISOString().slice(0, 10)),
    retry: false,
  });
  const quota = user?.quotaSizeInBytes;

  const tile = (label: string, value: string) => (
    <div className="rounded-xl bg-panel p-4">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tile(t('Photos'), formatNumber(stats.data?.images ?? 0))}
        {tile(t('Videos'), formatNumber(stats.data?.videos ?? 0))}
        {tile(t('Used by you'), formatBytes(user?.quotaUsageInBytes))}
        {tile(t('Disk free'), storage ? storage.diskAvailable : '-')}
      </div>
      {quota ? (
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted">
            <span>{t('Quota')}</span>
            <span>
              {formatBytes(user?.quotaUsageInBytes)} / {formatBytes(quota)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded bg-panel">
            <div className="h-full bg-primary" style={{ width: `${Math.min(100, ((user?.quotaUsageInBytes ?? 0) / quota) * 100)}%` }} />
          </div>
        </div>
      ) : null}
      <CalendarHeatmap data={heatmap.data} />
    </div>
  );
}
