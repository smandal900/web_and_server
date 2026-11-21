import { mdiCellphone, mdiDesktopClassic, mdiLogout } from '@mdi/js';
import { useQuery } from '@tanstack/react-query';
import { deleteOtherSessions, deleteSession, getSessions } from '../../../api/core';
import { Button, IconButton } from '../../../components/ui/Button';
import { Icon } from '../../../components/ui/Icon';
import { PageSpinner } from '../../../components/ui/Spinner';
import { useRun } from '../../../hooks/useRun';
import { t } from '../../../i18n';
import { timeAgo } from '../../../lib/format';

/** A browser's long user-agent string, shortened to something readable. */
function deviceName(s: { deviceType: string; deviceOS: string }) {
  const text = s.deviceOS || s.deviceType || '';
  const browser = /(Edg|Chrome|Firefox|Safari)\//.exec(text)?.[1]?.replace('Edg', 'Edge');
  const os = /(Windows|Mac OS X|Android|iPhone|Linux)/.exec(text)?.[1];
  return [browser, os].filter(Boolean).join(' on ') || text.slice(0, 40) || t('Unknown device');
}

export default function Devices() {
  const run = useRun();
  const sessions = useQuery({ queryKey: ['sessions'], queryFn: getSessions });
  const list = sessions.data ?? [];
  const others = list.filter((s) => !s.current);
  const refresh = [['sessions']];

  if (sessions.isLoading) return <PageSpinner />;
  return (
    <div>
      <ul className="divide-y divide-line">
        {list.map((s) => (
          <li key={s.id} className="flex items-center gap-3 py-3">
            <Icon path={/Android|iPhone/.test(s.deviceOS + s.deviceType) ? mdiCellphone : mdiDesktopClassic} className="text-muted" size={28} />
            <div className="flex-1">
              <p className="text-sm font-medium">
                {deviceName(s)} {s.current && <span className="ml-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">{t('This device')}</span>}
              </p>
              <p className="text-xs text-muted">{t('Last active {time}', { time: timeAgo(s.updatedAt) })}</p>
            </div>
            {!s.current && <IconButton path={mdiLogout} label={t('Sign out')} onClick={() => run(() => deleteSession(s.id), { success: t('Device signed out'), invalidate: refresh })} />}
          </li>
        ))}
      </ul>
      {others.length > 0 && (
        <Button variant="danger-outline" className="mt-3" onClick={() => run(() => deleteOtherSessions(), { success: t('Other devices signed out'), invalidate: refresh })}>
          {t('Sign out of all other devices')}
        </Button>
      )}
    </div>
  );
}
