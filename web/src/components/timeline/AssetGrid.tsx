import { useMemo, useRef } from 'react';
import { justifiedLayout } from '../../lib/justifiedLayout';
import { useElementWidth } from '../../hooks/useElementWidth';
import type { GridAsset } from './gridAsset';
import { Thumbnail } from './Thumbnail';

export const GAP = 2;
/** Row height scales with the screen: smaller on phones. */
export const rowHeightFor = (width: number) => (width < 600 ? 120 : width < 1200 ? 180 : 235);

interface AssetGridProps {
  assets: GridAsset[];
  /** Width in pixels. Leave out to let the grid measure its own parent. */
  width?: number;
  shareKey?: string;
  onOpen: (id: string) => void;
  selectable?: boolean;
}

/** Pictures laid out as a justified "photo wall": rows of equal height that fill the width. */
export function AssetGrid({ assets, width: given, shareKey, onOpen, selectable }: AssetGridProps) {
  const box = useRef<HTMLDivElement>(null);
  const measured = useElementWidth(box);
  const width = given ?? measured;

  const rows = useMemo(
    () => justifiedLayout(assets.map((a) => a.ratio), width, rowHeightFor(width), GAP),
    [assets, width],
  );

  return (
    <div ref={box} className="w-full" style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
      {rows.map((row) => (
        <div key={row.items[0].index} className="flex" style={{ gap: GAP, height: row.height }}>
          {row.items.map((item) => (
            <Thumbnail
              key={assets[item.index].id}
              asset={assets[item.index]}
              width={item.width}
              height={item.height}
              shareKey={shareKey}
              onOpen={onOpen}
              selectable={selectable}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
