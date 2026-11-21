import { useLayoutEffect, useState, type RefObject } from 'react';

/** The current pixel size of an element; updates when the window or the element is resized. */
export function useElementSize(ref: RefObject<HTMLElement | null>): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });
  // The element may appear after the first render (e.g. after a loading spinner), so depend on the element itself.
  const element = ref.current;
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
