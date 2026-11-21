import { useState, type FormEvent } from 'react';
import { mdiClose, mdiDeleteOutline, mdiHeart, mdiHeartOutline, mdiSend } from '@mdi/js';
import { useQuery } from '@tanstack/react-query';
import { addActivity, deleteActivity, getActivities } from '../../api/library';
import { useRun } from '../../hooks/useRun';
import { t } from '../../i18n';
import { timeAgo } from '../../lib/format';
import { useAuth } from '../../state/AuthProvider';
import { IconButton } from '../ui/Button';
import { Avatar } from '../ui/Misc';

/** Comments and likes on one picture of a shared album. */
export default function ActivityPanel({ albumId, assetId, onClose }: { albumId: string; assetId: string; onClose: () => void }) {
  const { user } = useAuth();
  const run = useRun();
  const [text, setText] = useState('');
  const key = ['activities', albumId, assetId];
  const list = useQuery({ queryKey: key, queryFn: () => getActivities(albumId, assetId), retry: false });
  const activities = list.data ?? [];
  const myLike = activities.find((a) => a.type === 'like' && a.user.id === user?.id);

  const toggleLike = () =>
    run(() => (myLike ? deleteActivity(myLike.id) : addActivity({ albumId, assetId, type: 'like' })), { invalidate: [key] });
  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const result = await run(() => addActivity({ albumId, assetId, type: 'comment', comment: text.trim() }), { invalidate: [key] });
    if (result.ok) setText('');
  };

  return (
    <aside className="flex h-full w-full shrink-0 flex-col border-l border-line bg-bg text-fg md:w-[22rem]" aria-label={t('Activity')}>
      <div className="flex items-center gap-2 px-3 py-2">
        <IconButton path={mdiClose} label={t('Close')} onClick={onClose} />
        <h2 className="flex-1 font-semibold">{t('Activity')}</h2>
        <IconButton path={myLike ? mdiHeart : mdiHeartOutline} label={myLike ? t('Unlike') : t('Like')} onClick={toggleLike} className={myLike ? 'text-danger' : ''} />
        <span className="text-sm text-muted">{activities.filter((a) => a.type === 'like').length}</span>
      </div>
      <ul className="flex-1 space-y-4 overflow-y-auto px-4 py-2">
        {activities
          .filter((a) => a.type === 'comment')
          .map((a) => (
            <li key={a.id} className="flex gap-3">
              <Avatar user={a.user} size={32} />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted">
                  {a.user.name} · {timeAgo(a.createdAt)}
                </p>
                <p className="text-sm break-words">{a.comment}</p>
              </div>
              {a.user.id === user?.id && <IconButton path={mdiDeleteOutline} label={t('Delete')} size={18} onClick={() => run(() => deleteActivity(a.id), { invalidate: [key] })} />}
            </li>
          ))}
        {!list.isLoading && activities.length === 0 && <li className="text-center text-sm text-muted">{t('No comments yet')}</li>}
      </ul>
      <form onSubmit={send} className="flex items-center gap-1 border-t border-line p-3">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('Write a comment')} className="min-w-0 flex-1 rounded-full bg-panel px-4 py-2 text-sm outline-none" />
        <IconButton path={mdiSend} label={t('Send')} type="submit" disabled={!text.trim()} />
      </form>
    </aside>
  );
}
