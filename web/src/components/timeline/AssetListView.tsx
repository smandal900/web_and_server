// A plain list of pictures (search results, memories, a shared link...) that has the same behaviour as the
// timeline: selection bar, viewer in the URL. Use this when the server returns an array, not months.
import { lazy, useMemo, type ReactNode } from 'react';
import type { Asset } from '../../api/types';
import type { ActionContext, ActionId } from '../../hooks/useAssetActions';
import { useAssetRoute } from '../../hooks/useAssetRoute';
import { Boundary } from '../ui/Boundary';
import { AssetGrid } from './AssetGrid';
import { fromAsset } from './gridAsset';
import { MAIN_ACTIONS } from './presets';
import { SelectionBar, type CustomAction } from './SelectionBar';
import { SelectionContext, useSelectionState } from './selection';

const AssetViewer = lazy(() => import('../viewer/AssetViewer'));

interface AssetListViewProps {
  assets: Asset[];
  base: string;
  actions?: ActionId[];
  actionContext?: ActionContext;
  shareKey?: string;
  albumId?: string;
  readOnly?: boolean;
  selectable?: boolean;
  customActions?: CustomAction[];
  /** Rendered above the grid. */
  header?: ReactNode;
  /** Rendered below the grid (a "load more" button, for example). */
  footer?: ReactNode;
}

export function AssetListView({ assets, base, actions = MAIN_ACTIONS, actionContext, shareKey, albumId, readOnly, selectable = true, customActions, header, footer }: AssetListViewProps) {
  const route = useAssetRoute(base);
  const grid = useMemo(() => assets.map(fromAsset), [assets]);
  const ids = useMemo(() => assets.map((a) => a.id), [assets]);
  const selection = useSelectionState(ids);
  const selected = useMemo(() => grid.filter((a) => selection.has(a.id)), [grid, selection]);

  return (
    <SelectionContext.Provider value={selectable ? selection : null}>
      <div className="relative h-full">
        {selection.active && <SelectionBar assets={selected} actions={actions} custom={customActions} context={actionContext} onClear={selection.clear} onSelectAll={() => selection.setMany(ids, true)} />}
        <div className="h-full overflow-y-auto px-3 pb-24">
          {header}
          <AssetGrid assets={grid} shareKey={shareKey} onOpen={route.open} selectable={selectable} />
          {footer}
        </div>
        {route.assetId && (
          <Boundary>
            <AssetViewer assetId={route.assetId} assetIds={ids} onShow={route.show} onClose={route.close} actions={actions} context={actionContext} albumId={albumId} shareKey={shareKey} readOnly={readOnly} />
          </Boundary>
        )}
      </div>
    </SelectionContext.Provider>
  );
}
