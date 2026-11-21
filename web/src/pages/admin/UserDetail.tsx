import { Link, useNavigate, useParams } from 'react-router';
import { mdiPencilOutline } from '@mdi/js';
import { useQuery } from '@tanstack/react-query';
import { getAdminUser, getAdminUserHeatmap, getAdminUserPreferences, getAdminUserSessions, getAdminUserStatistics } from '../../api/admin';
import { Button } from '../../components/ui/Button';
import { CalendarHeatmap } from '../../components/ui/CalendarHeatmap';
import { Avatar, Card } from '../../components/ui/Misc';
import { PageBody, PageHeader } from '../../components/ui/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { t } from '../../i18n';
import { formatBytes, formatDate, formatDateTime, timeAgo } from '../../lib/format';

/** Read-only overview of one account: facts, usage, sessions and activity. */
export default function UserDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const user = useQuery({ queryKey: ['admin-user', id], queryFn: () => getAdminUser(id) });
  const stats = useQuery({ queryKey: ['admin-user', id, 'stats'], queryFn: () => getAdminUserStatistics(id), retry: false });
  const sessions = useQuery({ queryKey: ['admin-user', id, 'sessions'], queryFn: () => getAdminUserSessions(id), retry: false });
  const prefs = useQuery({ queryKey: ['admin-user', id, 'prefs'], queryFn: () => getAdminUserPreferences(id), retry: false });
  const heat = useQuery({
    queryKey: ['admin-user', id, 'heatmap'],
    queryFn: () => getAdminUserHeatmap(id, new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10), new Date().toISOString().slice(0, 10)),
    retry: false,
  });
  const u = user.data;
  if (user.isLoading) return <PageSpinner />;
  if (!u) return <PageBody>{(user.error as Error)?.message}</PageBody>;

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={u.name}>
        <Button variant="outline" onClick={() => navigate('/admin/users')}>
          {t('Back')}
        </Button>
        <Link to={`/admin/users/${u.id}/edit`}>
          <Button icon={mdiPencilOutline}>{t('Edit')}</Button>
        </Link>
      </PageHeader>
      <PageBody>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title={t('Account')}>
            <div className="mb-3 flex items-center gap-3">
              <Avatar user={u} size={56} />
              <div>
                <p className="font-medium">{u.name}</p>
                <p className="text-sm text-muted">{u.email}</p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-1 text-sm">
              <dt className="text-muted">{t('Role')}</dt>
              <dd>{u.isAdmin ? t('Admin') : t('User')}</dd>
              <dt className="text-muted">{t('Created')}</dt>
              <dd>{formatDate(u.createdAt)}</dd>
              <dt className="text-muted">{t('Storage label')}</dt>
              <dd>{u.storageLabel ?? '-'}</dd>
              <dt className="text-muted">{t('Quota')}</dt>
              <dd>{u.quotaSizeInBytes ? formatBytes(u.quotaSizeInBytes) : t('Unlimited')}</dd>
              {u.deletedAt && (
                <>
                  <dt className="text-muted">{t('Removed')}</dt>
                  <dd className="text-danger">{formatDateTime(u.deletedAt)}</dd>
                </>
              )}
            </dl>
          </Card>
          <Card title={t('Usage')}>
            <dl className="grid grid-cols-3 gap-3 text-center">
              {[
                [t('Photos'), stats.data?.images ?? 0],
                [t('Videos'), stats.data?.videos ?? 0],
                [t('Used'), formatBytes(u.quotaUsageInBytes)],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl bg-panel p-3">
                  <dd className="text-xl font-semibold">{value}</dd>
                  <dt className="text-xs text-muted">{label}</dt>
                </div>
              ))}
            </dl>
          </Card>
          <Card title={t('Sessions')}>
            <ul className="divide-y divide-line text-sm">
              {(sessions.data ?? []).map((s) => (
                <li key={s.id} className="py-2">
                  <p className="truncate">{s.deviceType || s.deviceOS || t('Unknown device')}</p>
                  <p className="text-xs text-muted">{t('Last active {time}', { time: timeAgo(s.updatedAt) })}</p>
                </li>
              ))}
              {(sessions.data?.length ?? 0) === 0 && <li className="text-muted">{t('No active sessions')}</li>}
            </ul>
          </Card>
          <Card title={t('Preferences')}>
            {prefs.data ? (
              <ul className="space-y-1 text-sm">
                {Object.entries(prefs.data).map(([group, values]) => (
                  <li key={group}>
                    <span className="font-medium">{group}</span>
                    <span className="text-muted"> · {Object.entries(values as Record<string, unknown>).map(([k, v]) => `${k}: ${String(v)}`).join(', ')}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{t('Not available')}</p>
            )}
          </Card>
          <Card title={t('Activity')} className="lg:col-span-2">
            <CalendarHeatmap data={heat.data} />
          </Card>
        </div>
      </PageBody>
    </div>
  );
}
