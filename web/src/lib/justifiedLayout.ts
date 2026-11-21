// Packs pictures into rows of equal height that fill the container width (like a photo wall).
//
// Idea: add pictures to a row until, at the target height, the row is at least as wide as
// the container. Then scale the whole row down so it fits exactly. The last row is left at
// the target height instead of being stretched.

export interface LayoutItem {
  index: number; // position in the input array
  width: number;
  height: number;
}
export interface LayoutRow {
  height: number;
  items: LayoutItem[];
}

export function justifiedLayout(ratios: number[], containerWidth: number, targetHeight: number, gap = 2): LayoutRow[] {
  const rows: LayoutRow[] = [];
  if (containerWidth <= 0 || ratios.length === 0) return rows;

  let current: number[] = []; // indexes in the row being built
  let ratioSum = 0;

  const closeRow = (stretch: boolean) => {
    const gaps = gap * (current.length - 1);
    // Height at which the row exactly fills the width.
    const fitted = (containerWidth - gaps) / ratioSum;
    const height = stretch ? fitted : Math.min(fitted, targetHeight);
    rows.push({
      height,
      items: current.map((index) => ({ index, width: ratios[index] * height, height })),
    });
    current = [];
    ratioSum = 0;
  };

  ratios.forEach((raw, index) => {
    const ratio = raw > 0 ? raw : 1;
    ratios[index] = ratio;
    current.push(index);
    ratioSum += ratio;
    const widthAtTarget = ratioSum * targetHeight + gap * (current.length - 1);
    if (widthAtTarget >= containerWidth) closeRow(true);
  });
  if (current.length > 0) closeRow(false);
  return rows;
}

/** Total pixel height of a set of rows including the gaps between them. */
export const rowsHeight = (rows: LayoutRow[], gap = 2) =>
  rows.reduce((sum, r) => sum + r.height, 0) + gap * Math.max(0, rows.length - 1);
