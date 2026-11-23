import { useLayoutEffect, useState, type RefObject } from 'react';

/** The current pixel size of an element; updates when the window or the element is resized. */
export function useElementSize(ref: RefObject<HTMLElement | null>): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [element, setElement] = useState<HTMLElement | null>(null);

  // The element does not exist during the first render (React attaches refs after it), and it may also appear later (after a
  // loading spinner). So look at the ref after every render and remember the element once it is there; setting it here
  // re-renders straight away, before the browser paints. Reading `ref.current` while rendering, as this hook did before,
  // saw `null` on the first render and, when nothing else re-rendered the component, never measured it: the width stayed 0.
  useLayoutEffect(() => {
    if (ref.current !== element) setElement(ref.current);
  });

  useLayoutEffect(() => {
    const el = element;
    if (!el) return;
    const update = () => setSize((s) => (s.width === el.clientWidth && s.height === el.clientHeight ? s : { width: el.clientWidth, height: el.clientHeight }));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [element]);

  return size;
}

export const useElementWidth = (ref: RefObject<HTMLElement | null>): number => useElementSize(ref).width;
