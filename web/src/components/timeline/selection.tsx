// Multi-select shared by a grid and its thumbnails.
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

export interface SelectionApi {
  selected: Set<string>;
  active: boolean;
  /** Pick mode (asset pickers): a click always selects, it never opens the viewer. */
  alwaysSelect: boolean;
  has: (id: string) => boolean;
  /** Toggle one picture. With `range` true, select everything between the last click and this one. */
  toggle: (id: string, range?: boolean) => void;
  /** Select (or unselect) many at once, e.g. a whole day. */
  setMany: (ids: string[], on: boolean) => void;
  clear: () => void;
}

export const SelectionContext = createContext<SelectionApi | null>(null);
/** Thumbnails read the selection from here. It is null on pages where selecting is not offered. */
export const useSelectionContext = () => useContext(SelectionContext);

/**
 * Keeps the set of selected ids. `orderedIds` is the on-screen order, needed for shift-click ranges.
 * Provide the result with <SelectionContext.Provider value={api}>.
 */
export function useSelectionState(orderedIds: string[], alwaysSelect = false): SelectionApi {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const anchor = useRef<string | null>(null);
  const ordered = useRef(orderedIds);
  ordered.current = orderedIds;

  const toggle = useCallback((id: string, range?: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (range && anchor.current) {
        const from = ordered.current.indexOf(anchor.current);
        const to = ordered.current.indexOf(id);
        if (from >= 0 && to >= 0) {
          const [a, b] = from < to ? [from, to] : [to, from];
          for (const rangeId of ordered.current.slice(a, b + 1)) next.add(rangeId);
          return next;
        }
      }
      if (next.has(id)) next.delete(id);
      else next.add(id);
      anchor.current = id;
      return next;
    });
  }, []);

  const setMany = useCallback((ids: string[], on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setSelected(new Set());
    anchor.current = null;
  }, []);

  return useMemo(
    () => ({ selected, active: selected.size > 0, alwaysSelect, has: (id: string) => selected.has(id), toggle, setMany, clear }),
    [selected, alwaysSelect, toggle, setMany, clear],
  );
}
