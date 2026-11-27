// The photo grid of every screen, like the Android app: month and day headings, four square tiles per row, similar
// photos on one tile with their number, long press to select, and the viewer on top.
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import {
  mdiArchiveArrowDownOutline,
  mdiArchiveArrowUpOutline,
  mdiCheckCircle,
  mdiCircleOutline,
  mdiClose,
  mdiDeleteForeverOutline,
  mdiDeleteOutline,
  mdiDeleteRestore,
  mdiHeart,
  mdiHeartOutline,
  mdiImageMultipleOutline,
  mdiImagePlusOutline,
  mdiLayers,
  mdiPlay,
} from '@mdi/js';
import { thumbnailUrl } from '@web/api/assets';
import type { TimelineAsset } from '@web/api/types';
import { Icon } from '@web/components/ui/Icon';
import { useFeatures } from '@web/hooks/useServer';
import { formatDayHeading, formatMonth, groupByDay } from '@web/lib/dates';
import { formatDuration } from '@web/lib/format';
import { coverOf, groupSimilar } from '@web/lib/similar';
import { thumbhashUrl } from '@web/lib/thumbhash';
import { similarOn } from '../prefs';
import { AlbumPicker, useActions } from './actions';
import { Confirm, IconButton, Message, Spinner } from './ui';

const Viewer = lazy(() => import('./Viewer'));

export type GalleryKind = 'library' | 'favorites' | 'archive' | 'bin' | 'album' | 'search';

/** One month (or the whole result of a search). `assets` is missing until it has been loaded. */
export interface Section {
  key: string;
  count: number;
  assets?: TimelineAsset[];
}

interface GalleryProps {
  kind: GalleryKind;
  sections: Section[];
  loading?: boolean;
  empty: string;
  /** A month came near the screen: load it. */
  onNear?: (key: string) => void;
  /** Month headings (a search result has none). */
  months?: boolean;
  /** Above the first month; scrolls with the pictures. */
  header?: ReactNode;
}

export function Gallery({ kind, sections, loading, empty, onNear, months = true, header }: GalleryProps) {
  const [selected, setSelected] = useState<Map<string, TimelineAsset>>(new Map());
  const [params, setParams] = useSearchParams();
  const openId = params.get('photo');
  const similar = similarOn() && kind !== 'bin';
  const ordered = useMemo(() => sections.flatMap((s) => s.assets ?? []), [sections]);

  /** Select all of these, or none of them when all are selected already. */
  const toggle = (assets: TimelineAsset[]) =>
    setSelected((old) => {
      const next = new Map(old);
      const all = assets.every((a) => next.has(a.id));
      for (const a of assets) {
        if (all) next.delete(a.id);
        else next.set(a.id, a);
      }
      return next;
    });
  const clear = () => setSelected(new Map());

  const open = (id: string) =>
    setParams((p) => {
      p.set('photo', id);
      return p;
    });
  // moving between pictures replaces the address, so "back" always returns to the grid
  const show = (id: string) => setParams((p) => (p.set('photo', id), p), { replace: true });
  const close = () => history.back();

  const group = useMemo(() => {
    if (!openId || !similar) return undefined;
    const day = groupByDay(ordered).find((d) => d.assets.some((a) => a.id === openId));
    const found = day && groupSimilar(day.assets).find((g) => g.some((a) => a.id === openId));
    return found && found.length > 1 ? found : undefined;
  }, [openId, similar, ordered]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {selected.size > 0 && <SelectionBar kind={kind} selected={[...selected.values()]} onDone={clear} />}
      <div className="min-h-0 flex-1 overflow-y-auto" data-gallery>
        {header}
        {loading && <Spinner />}
        {!loading && sections.length === 0 && <Message icon={mdiImageMultipleOutline} text={empty} />}
        {sections.map((section) => (
          <MonthView key={section.key} section={section} onNear={onNear} heading={months ? formatMonth(section.key) : undefined}>
            {section.assets &&
              groupByDay(section.assets).map((day) => {
                const ticked = day.assets.every((a) => selected.has(a.id));
                const groups = similar ? groupSimilar(day.assets) : day.assets.map((a) => [a]);
                return (
                  <section key={day.day}>
                    <div className="flex items-center justify-between py-1 pr-1 pl-3">
                      <h3 className="text-base font-medium">{formatDayHeading(day.day)}</h3>
                      <button type="button" aria-label={ticked ? 'Deselect day' : 'Select day'} onClick={() => toggle(day.assets)} className={`flex size-10 items-center justify-center ${ticked ? 'text-primary' : 'text-muted'}`}>
                        <Icon path={ticked ? mdiCheckCircle : mdiCircleOutline} size={22} />
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-0.5 md:grid-cols-8">
                      {groups.map((members) => {
                        const cover = coverOf(members);
                        return (
                          <Tile
                            key={cover.id}
                            asset={cover}
                            count={members.length}
                            selected={members.every((a) => selected.has(a.id))}
                            selecting={selected.size > 0}
                            onOpen={() => open(cover.id)}
                            onSelect={() => toggle(members)}
                          />
                        );
                      })}
                    </div>
                  </section>
                );
              })}
          </MonthView>
        ))}
      </div>
      {openId && (
        <Suspense fallback={<div className="fixed inset-0 z-40 bg-black" />}>
          <Viewer kind={kind} id={openId} assets={ordered} group={group} onShow={show} onClose={close} />
        </Suspense>
      )}
    </div>
  );
}

function MonthView({ section, heading, onNear, children }: { section: Section; heading?: string; onNear?: (key: string) => void; children: ReactNode }) {
  const box = useRef<HTMLElement>(null);
  const loaded = !!section.assets;
  useEffect(() => {
    if (loaded || !onNear || !box.current) return;
    const observer = new IntersectionObserver((entries) => entries[0].isIntersecting && onNear(section.key), { rootMargin: '100% 0px' });
    observer.observe(box.current);
    return () => observer.disconnect();
  }, [loaded, onNear, section.key]);
  return (
    // content-visibility: months off the screen are not drawn
    <section ref={box} className="[content-visibility:auto]" style={loaded ? undefined : { minHeight: `${Math.ceil(section.count / 4) * 25}vw` }}>
      {heading && <h2 className="px-3 pt-6 pb-2 text-3xl">{heading}</h2>}
      {children}
    </section>
  );
}

function Tile({ asset, count, selected, selecting, onOpen, onSelect }: { asset: TimelineAsset; count: number; selected: boolean; selecting: boolean; onOpen: () => void; onSelect: () => void }) {
  // holding a tile selects it; the tap that ends the hold does nothing more
  const hold = useRef<{ timer?: ReturnType<typeof setTimeout>; x: number; y: number; done: boolean }>({ x: 0, y: 0, done: false });
  const release = () => clearTimeout(hold.current.timer);
  const placeholder = thumbhashUrl(asset.thumbhash);
  return (
    <button
      type="button"
      aria-label={`${asset.isImage ? 'Photo' : 'Video'}${count > 1 ? `, ${count} similar` : ''}`}
      aria-pressed={selecting ? selected : undefined}
      data-asset-id={asset.id}
      className="relative aspect-square overflow-hidden bg-panel select-none [-webkit-touch-callout:none]"
      style={placeholder ? { backgroundImage: `url(${placeholder})`, backgroundSize: 'cover' } : undefined}
      onPointerDown={(e) => {
        release();
        hold.current = {
          x: e.clientX,
          y: e.clientY,
          done: false,
          timer: setTimeout(() => {
            hold.current.done = true;
            onSelect();
            navigator.vibrate?.(15);
          }, 450),
        };
      }}
      onPointerMove={(e) => Math.hypot(e.clientX - hold.current.x, e.clientY - hold.current.y) > 10 && release()}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (hold.current.done) hold.current.done = false;
        else if (selecting) onSelect();
        else onOpen();
      }}
    >
      <img src={thumbnailUrl(asset.id)} alt="" loading="lazy" decoding="async" draggable={false} className={`size-full object-cover transition ${selected ? 'scale-85 rounded-lg' : ''}`} />
      {selecting && (
        <span className={`absolute top-1 left-1 flex rounded-full drop-shadow ${selected ? 'bg-white text-primary' : 'text-white'}`}>
          <Icon path={selected ? mdiCheckCircle : mdiCircleOutline} size={22} />
        </span>
      )}
      <span className="absolute top-1 right-1 flex items-center gap-1 text-xs font-medium text-white">
        {!asset.isImage && (
          <span className="flex items-center drop-shadow">
            {asset.duration ? formatDuration(asset.duration) : ''}
            <Icon path={mdiPlay} size={16} />
          </span>
        )}
        {count > 1 && (
          <span className="flex items-center gap-0.5 rounded-full bg-black/55 px-1.5 py-0.5">
            {count}
            <Icon path={mdiLayers} size={13} />
          </span>
        )}
      </span>
      {asset.isFavorite && <Icon path={mdiHeart} size={16} className="absolute bottom-1 left-1 text-white drop-shadow" />}
    </button>
  );
}

function SelectionBar({ kind, selected, onDone }: { kind: GalleryKind; selected: TimelineAsset[]; onDone: () => void }) {
  const actions = useActions();
  const trash = useFeatures().data?.trash !== false;
  const [confirm, setConfirm] = useState(false);
  const [picking, setPicking] = useState(false);
  const ids = selected.map((a) => a.id);
  const allFavorite = selected.every((a) => a.isFavorite);
  const forever = kind === 'bin' || !trash;
  const then = async (change: Promise<boolean>) => (await change) && onDone();

  return (
    <div className="absolute inset-x-0 top-0 z-30 flex items-center gap-0.5 bg-panel px-2 py-1 shadow-lg">
      <IconButton path={mdiClose} label="Clear selection" onClick={onDone} />
      <span className="flex-1 text-base font-semibold">{ids.length} selected</span>
      {kind === 'bin' ? (
        <IconButton path={mdiDeleteRestore} label="Restore" onClick={() => void then(actions.restore(ids))} />
      ) : (
        <>
          <IconButton path={allFavorite ? mdiHeartOutline : mdiHeart} label={allFavorite ? 'Remove from favorites' : 'Favorite'} onClick={() => void then(actions.favorite(ids, !allFavorite))} />
          <IconButton path={mdiImagePlusOutline} label="Add to album" onClick={() => setPicking(true)} />
          <IconButton path={kind === 'archive' ? mdiArchiveArrowUpOutline : mdiArchiveArrowDownOutline} label={kind === 'archive' ? 'Unarchive' : 'Archive'} onClick={() => void then(actions.archive(ids, kind !== 'archive'))} />
        </>
      )}
      <IconButton path={forever ? mdiDeleteForeverOutline : mdiDeleteOutline} label="Delete" onClick={() => setConfirm(true)} />
      {confirm && (
        <Confirm
          title={`Delete ${ids.length} item(s)?`}
          text={forever ? 'They will be deleted for good.' : 'They will be moved to the bin.'}
          action="Delete"
          onYes={() => void then(actions.remove(ids, forever))}
          onClose={() => setConfirm(false)}
        />
      )}
      {picking && (
        <AlbumPicker
          ids={ids}
          onClose={(added) => {
            setPicking(false);
            if (added) onDone();
          }}
        />
      )}
    </div>
  );
}
