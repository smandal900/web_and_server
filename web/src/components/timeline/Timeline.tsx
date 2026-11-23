import { lazy, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getTimelineSelection } from '../../api/assets';
import type { Asset, TimelineQuery } from '../../api/types';
import { useAssetRoute } from '../../hooks/useAssetRoute';
import { useRun } from '../../hooks/useRun';
import type { ActionContext, ActionId } from '../../hooks/useAssetActions';
import { useShortcut } from '../../hooks/useShortcuts';
import { useTimelineBuckets, useTimelineMonths } from '../../hooks/useTimeline';
import { useElementWidth } from '../../hooks/useElementWidth';
import { Boundary } from '../ui/Boundary';
import { PageSpinner } from '../ui/Spinner';
import { EmptyState } from '../ui/Misc';
import { mdiAlertCircleOutline } from '@mdi/js';
import { t } from '../../i18n';
import { fromSelection, fromTimeline, type GridAsset } from './gridAsset';
import { MonthSection } from './MonthSection';
import { SelectionBar, type CustomAction, type PickMode } from './SelectionBar';
import { SelectionContext, useSelectionState } from './selection';
import { MAIN_ACTIONS } from './presets';

const Scrubber = lazy(() => import('./Scrubber'));
const AssetViewer = lazy(() => import('../viewer/AssetViewer'));

export interface TimelineProps {
  /** Filters sent to the server: favorites, archive, album, person... */
  query: TimelineQuery;
  /** The page's own path (e.g. "/favorites"); the viewer adds /photos/<id> to it. */
  base: string;
  /** Shown when there are no pictures at all. */
  empty: ReactNode;
  actions?: ActionId[];
  actionContext?: ActionContext;
  /** Content above the first month (an album's title block, for example). It scrolls with the pictures. */
  header?: ReactNode;
  shareKey?: string;
  selectable?: boolean;
  /** Actions shown in the viewer's top bar (defaults to the same as the selection bar). */
  albumId?: string;
  readOnly?: boolean;
  /** Extra buttons in the selection bar (e.g. "Set as album cover"). */
  customActions?: CustomAction[];
  /** Asset-picker mode: clicks select, and one button hands the chosen ids to the caller. */
  pick?: PickMode;
}

/**
 * The main picture list: months -> days -> justified rows.
 *   - only the month list is fetched up front; each month's pictures load when it nears the screen
 *   - selecting pictures shows the action bar; clicking one opens the viewer (URL-driven)
 */
export function Timeline(props: TimelineProps) {
  // Starting fresh when the filters change is simplest done by remounting.
  return <TimelineInner key={JSON.stringify(props.query)} {...props} />;
}

function TimelineInner({ query, base, empty, actions = MAIN_ACTIONS, actionContext, header, shareKey, selectable = true, albumId, readOnly, customActions, pick }: TimelineProps) {
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);
  // A state-backed ref: the width is re-measured as soon as the list container actually exists.
  const [inner, setInner] = useState<HTMLDivElement | null>(null);
  const width = useElementWidth({ current: inner });
  const route = useAssetRoute(base);

  const buckets = useTimelineBuckets(query);
  const bucketList = useMemo(() => buckets.data ?? [], [buckets.data]);
  // Memory: only months near the screen are loaded ("near"). While the viewer is open, the months it needs stay loaded too ("pinned").
  const [near, setNear] = useState<string[]>([]);
  const [pinned, setPinned] = useState<string[]>([]);
  const onNear = useCallback((month: string) => setNear((r) => (r.includes(month) ? r : [...r, month])), []);
  const onFar = useCallback((month: string) => setNear((r) => (r.includes(month) ? r.filter((m) => m !== month) : r)), []);
  const pin = useCallback((month: string) => setPinned((r) => (r.includes(month) ? r : [...r, month])), []);
  const viewerOpen = !!route.assetId;
  useEffect(() => {
    if (!viewerOpen) setPinned([]);
  }, [viewerOpen]);
  const requested = useMemo(() => [...new Set([...near, ...pinned])], [near, pinned]);
  const { byMonth, ordered } = useTimelineMonths(requested, query, bucketList);

  const orderedIds = useMemo(() => ordered.map((a) => a.id), [ordered]);
  const selection = useSelectionState(orderedIds, !!pick);

  // "Select all" means every picture of this view, also the months that are not loaded (only months near the screen are,
  // to save memory). The server lists them as small [id, flags] rows; those not loaded are kept here, so the count and
  // every action (favorite, archive, trash, album ...) cover the whole selection.
  const run = useRun();
  const [unloaded, setUnloaded] = useState<Map<string, GridAsset>>(new Map());
  const selectEverything = useCallback(async () => {
    const result = await run(() => getTimelineSelection(query));
    if (!result.ok) return;
    setUnloaded(new Map(result.data.map((row) => [row[0], fromSelection(row)])));
    selection.setMany(
      result.data.map((row) => row[0]),
      true,
    );
  }, [run, query, selection.setMany]);
  const clearSelection = useCallback(() => {
    selection.clear();
    setUnloaded(new Map());
  }, [selection.clear]);

  const selectedAssets = useMemo(() => {
    const loaded = new Map(ordered.map((a) => [a.id, a]));
    const list: GridAsset[] = [];
    for (const id of selection.selected) {
      const a = loaded.get(id);
      const known = a ? fromTimeline(a) : unloaded.get(id);
      if (known) list.push(known);
    }
    return list;
  }, [ordered, selection.selected, unloaded]);

  useShortcut('a', (e) => (e.preventDefault(), void selectEverything()), { modifier: 'ctrl' });

  // A viewer link opened directly: make sure the month of that picture is loaded so prev/next work.
  const onAssetLoaded = useCallback((asset: Asset) => pin(`${(asset.localDateTime ?? asset.fileCreatedAt).slice(0, 7)}-01`), [pin]);

  // At the end of the loaded list, load the next month so "next" keeps working.
  const onNeedMore = useCallback(() => {
    // the month after the last one that has data, in display order
    let last = -1;
    bucketList.forEach((b, i) => byMonth.get(b.timeBucket)?.assets && (last = i));
    const next = bucketList[last + 1];
    if (next) pin(next.timeBucket);
  }, [bucketList, byMonth, pin]);

  if (buckets.isLoading) return <PageSpinner />;
  if (buckets.isError) return <EmptyState icon={mdiAlertCircleOutline} title={t('Could not load pictures')} text={(buckets.error as Error).message} />;

  const isEmpty = bucketList.length === 0;
  return (
    <SelectionContext.Provider value={selectable ? selection : null}>
      <div className="relative h-full">
        {(selection.active || pick) && (
          <SelectionBar assets={selectedAssets} actions={actions} custom={customActions} pick={pick} context={actionContext} onClear={clearSelection} onSelectAll={() => void selectEverything()} />
        )}
        <div ref={setScrollRoot} className="h-full overflow-y-auto pr-14 pl-3 max-md:pr-8" data-timeline-scroll>
          {header}
          <div ref={setInner} className="pb-24">
            {isEmpty ? (
              empty
            ) : (
              bucketList.map((bucket) => (
                <MonthSection
                  key={bucket.timeBucket}
                  bucket={bucket}
                  width={width}
                  assets={byMonth.get(bucket.timeBucket)?.assets}
                  failed={!!byMonth.get(bucket.timeBucket)?.error}
                  scrollRoot={scrollRoot}
                  onNear={onNear}
                  onFar={onFar}
                  onOpen={route.open}
                  shareKey={shareKey}
                  selectable={selectable}
                />
              ))
            )}
          </div>
        </div>
        {!isEmpty && (
          <Boundary compact fallback={null}>
            <Scrubber buckets={bucketList} scrollRoot={scrollRoot} />
          </Boundary>
        )}
        {route.assetId && (
          <Boundary>
            <AssetViewer
              assetId={route.assetId}
              assetIds={orderedIds}
              onShow={route.show}
              onClose={route.close}
              onAssetLoaded={onAssetLoaded}
              onNeedMore={onNeedMore}
              actions={actions}
              context={actionContext}
              albumId={albumId}
              shareKey={shareKey}
              readOnly={readOnly}
            />
          </Boundary>
        )}
      </div>
    </SelectionContext.Provider>
  );
}
