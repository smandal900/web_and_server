// A memory played like a story: one picture at a time with progress bars, auto-advance and prev/next.
import { lazy, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { mdiChevronLeft, mdiChevronRight, mdiClose, mdiDeleteOutline, mdiPause, mdiPlay, mdiViewGridOutline } from '@mdi/js';
import { useQuery } from '@tanstack/react-query';
import { thumbnailUrl, videoUrl } from '../../api/assets';
import { deleteMemory, getMemories, getMemory } from '../../api/library';
import { AssetListView } from '../../components/timeline/AssetListView';
import { READONLY_ACTIONS } from '../../components/timeline/presets';
import { Boundary } from '../../components/ui/Boundary';
import { IconButton } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/Misc';
import { PageSpinner } from '../../components/ui/Spinner';
import { usePreferences } from '../../hooks/usePreferences';
import { useRun } from '../../hooks/useRun';
import { useShortcut } from '../../hooks/useShortcuts';
import { t } from '../../i18n';
import { cx } from '../../lib/cx';
import { formatDate } from '../../lib/format';
import { mdiTimerSand } from '@mdi/js';

const Confetti = lazy(() => import('../../components/ui/Confetti'));

/** `/memories/:id` plays that memory; `/memory` plays the first memory of today. */
export default function MemoryViewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const run = useRun();
  const { preferences } = usePreferences();
  const memories = useQuery({ queryKey: ['memories'], queryFn: getMemories, retry: false });
  const single = useQuery({ queryKey: ['memory', id], queryFn: () => getMemory(id!), enabled: !!id && !memories.data?.some((m) => m.id === id), retry: false });
  const memory = memories.data?.find((m) => m.id === id) ?? single.data ?? (!id ? memories.data?.[0] : undefined);

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [grid, setGrid] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const assets = memory?.assets ?? [];
  const current = assets[index];
  const seconds = preferences.memories.duration || 5;

  useEffect(() => setIndex(0), [memory?.id]);
  useEffect(() => {
    if (!current || paused || grid || current.type === 'VIDEO') return;
    const timer = setTimeout(() => (index < assets.length - 1 ? setIndex(index + 1) : setPaused(true)), seconds * 1000);
    return () => clearTimeout(timer);
  }, [index, current, paused, grid, assets.length, seconds]);

  useShortcut('ArrowRight', () => setIndex((i) => Math.min(assets.length - 1, i + 1)));
  useShortcut('ArrowLeft', () => setIndex((i) => Math.max(0, i - 1)));
  useShortcut('Escape', () => navigate('/photos'));

  if (memories.isLoading || single.isLoading) return <PageSpinner />;
  if (!memory || !current) return <EmptyState icon={mdiTimerSand} title={t('No memory to show')} text={t('Come back on another day.')} />;

  const years = new Date().getFullYear() - memory.data.year;
  const title = years <= 0 ? t('This year') : t('{count} years ago', { count: years });

  if (grid) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center gap-2 border-b border-line px-4">
          <IconButton path={mdiChevronLeft} label={t('Back')} onClick={() => setGrid(false)} />
          <h1 className="text-lg font-semibold">{title}</h1>
        </div>
        <div className="min-h-0 flex-1">
          <AssetListView assets={assets} base={`/memories/${memory.id}`} actions={READONLY_ACTIONS} />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col bg-black text-white">
      <div className="absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/70 to-transparent p-3">
        <div className="flex gap-1">
          {assets.map((a, i) => (
            <button key={a.id} aria-label={`Picture ${i + 1}`} onClick={() => setIndex(i)} className="h-1.5 flex-1 overflow-hidden rounded bg-white/30">
              <span className={cx('block h-full bg-white', i < index && 'w-full', i === index && (paused || current.type === 'VIDEO') && 'w-full')} style={i === index && !paused && current.type !== 'VIDEO' ? { animation: `grow ${seconds}s linear forwards` } : undefined} />
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-1">
          <IconButton path={mdiClose} label={t('Close')} onClick={() => navigate('/photos')} />
          <div className="mr-auto ml-1">
            <p className="font-medium">{title}</p>
            <p className="text-xs text-white/70">{formatDate(current.localDateTime ?? current.fileCreatedAt, { dateStyle: 'long' })}</p>
          </div>
          <IconButton path={paused ? mdiPlay : mdiPause} label={paused ? t('Play') : t('Pause')} onClick={() => setPaused(!paused)} />
          <IconButton path={mdiViewGridOutline} label={t('Show all')} onClick={() => setGrid(true)} />
          <IconButton path={mdiDeleteOutline} label={t('Delete memory')} onClick={() => setConfirm(true)} />
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        {current.type === 'VIDEO' ? (
          <video key={current.id} src={videoUrl(current.id)} autoPlay controls playsInline onEnded={() => index < assets.length - 1 && setIndex(index + 1)} className="max-h-full max-w-full" />
        ) : (
          <img key={current.id} src={thumbnailUrl(current.id, 'preview')} alt="" className="max-h-full max-w-full object-contain" />
        )}
        {index > 0 && <IconButton path={mdiChevronLeft} label={t('Previous')} size={32} onClick={() => setIndex(index - 1)} className="absolute left-3 bg-black/40 text-white hover:bg-black/60" />}
        {index < assets.length - 1 && <IconButton path={mdiChevronRight} label={t('Next')} size={32} onClick={() => setIndex(index + 1)} className="absolute right-3 bg-black/40 text-white hover:bg-black/60" />}
      </div>
      {memory.type === 'on_this_day' && memory.data && (memory as { data: { birthday?: boolean } }).data.birthday && (
        <Boundary compact fallback={null}>
          <Confetti />
        </Boundary>
      )}
      <style>{'@keyframes grow{from{width:0}to{width:100%}}'}</style>
      {confirm && (
        <ConfirmDialog
          title={t('Delete this memory?')}
          message={t('The photos stay in your library.')}
          confirmText="Delete"
          danger
          onClose={() => setConfirm(false)}
          onConfirm={() => run(() => deleteMemory(memory.id), { success: t('Memory deleted'), invalidate: [['memories']] }).then((r) => r.ok && navigate('/photos'))}
        />
      )}
    </div>
  );
}
