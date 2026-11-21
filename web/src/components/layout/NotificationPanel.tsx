import { useEffect, useRef } from 'react';
import { mdiBellOffOutline } from '@mdi/js';
import { useQuery } from '@tanstack/react-query';
import { deleteNotification, getNotifications, markAllNotificationsRead, markNotificationRead } from '../../api/admin';
import { useRun } from '../../hooks/useRun';
import { t } from '../../i18n';
import { timeAgo } from '../../lib/format';
import { Icon } from '../ui/Icon';
import { Spinner } from '../ui/Spinner';

/** Dropdown under the bell: newest first, click to mark read, × to dismiss. */
export default function NotificationPanel({ onClose }: { onClose: () => void }) {
  const run = useRun();
  const root = useRef<HTMLDivElement>(null);
  const list = useQuery({ queryKey: ['notifications'], queryFn: getNotifications, retry: false });
  const items = list.data ?? [];

  useEffect(() => {
    const close = (e: MouseEvent) => !root.current?.contains(e.target as Node) && onClose();
    setTimeout(() => document.addEventListener('mousedown', close));
    return () => document.removeEventListener('mousedown', close);
  }, [onClose]);

  return (
    <div ref={root} className="absolute right-0 z-[8000] mt-1 w-80 rounded-2xl border border-line bg-bg shadow-xl">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h3 className="font-semibold">{t('Notifications')}</h3>
        {items.some((n) => !n.readAt) && (
          <button className="text-xs text-primary" onClick={() => run(() => markAllNotificationsRead(), { invalidate: [['notifications']] })}>
            {t('Mark all read')}
          </button>
        )}
      </div>
      <div className="max-h-96 overflow-y-auto">
        {list.isLoading && (
          <div className="flex justify-center p-6">
            <Spinner />
          </div>
        )}
        {!list.isLoading && items.length === 0 && (
          <div className="flex flex-col items-center gap-2 p-8 text-sm text-muted">
            <Icon path={mdiBellOffOutline} size={36} />
            {t('You have no notifications')}
          </div>
        )}
        {items.map((n) => (
          <div key={n.id} className="flex gap-2 border-b border-line px-4 py-3 last:border-0">
            <button className="flex-1 text-left" onClick={() => !n.readAt && run(() => markNotificationRead(n.id), { invalidate: [['notifications']], quiet: true })}>
              <p className={n.readAt ? 'text-sm text-muted' : 'text-sm font-medium'}>{n.title}</p>
              {n.description && <p className="text-xs text-muted">{n.description}</p>}
              <p className="text-xs text-muted">{timeAgo(n.createdAt)}</p>
            </button>
            <button aria-label="Dismiss" className="text-muted hover:text-fg" onClick={() => run(() => deleteNotification(n.id), { invalidate: [['notifications']], quiet: true })}>
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
