import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { clamp } from '../lib/format';

const MAX_SCALE = 8;

/**
 * Wheel / pinch zoom and drag-to-pan for one element, with the zoom centred on the cursor.
 * Apply the returned `style` to the element that should move; `ref` is the (fixed) area that receives the gestures.
 *   Double click toggles between fit and 2.5x.
 */
export function useZoomPan(area: RefObject<HTMLElement | null>) {
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const lastDistance = useRef(0);
  const drag = useRef<{ x: number; y: number } | null>(null);

  const reset = useCallback(() => setView({ scale: 1, x: 0, y: 0 }), []);

  /** Zoom by `factor`, keeping the point (cx, cy) - measured from the area's centre - under the cursor. */
  const zoomAt = useCallback((factor: number, cx: number, cy: number) => {
    setView((v) => {
      const scale = clamp(v.scale * factor, 1, MAX_SCALE);
      if (scale === 1) return { scale: 1, x: 0, y: 0 };
      const ratio = scale / v.scale;
      return { scale, x: cx - (cx - v.x) * ratio, y: cy - (cy - v.y) * ratio };
    });
  }, []);

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const fromCentre = (e: { clientX: number; clientY: number }) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 };
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = fromCentre(e);
      zoomAt(Math.exp(-e.deltaY * 0.0015), p.x, p.y);
    };
    const onDown = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId);
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      drag.current = { x: e.clientX, y: e.clientY };
      lastDistance.current = 0;
    };
    const onMove = (e: PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const points = [...pointers.current.values()];
      if (points.length === 2) {
        // two fingers: pinch
        const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
        if (lastDistance.current) {
          const mid = fromCentre({ clientX: (points[0].x + points[1].x) / 2, clientY: (points[0].y + points[1].y) / 2 });
          zoomAt(distance / lastDistance.current, mid.x, mid.y);
        }
        lastDistance.current = distance;
      } else if (drag.current) {
        const dx = e.clientX - drag.current.x;
        const dy = e.clientY - drag.current.y;
        drag.current = { x: e.clientX, y: e.clientY };
        setView((v) => (v.scale > 1 ? { ...v, x: v.x + dx, y: v.y + dy } : v));
      }
    };
    const onUp = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId);
      lastDistance.current = 0;
      drag.current = null;
    };
    const onDouble = (e: MouseEvent) => {
      const p = fromCentre(e);
      setView((v) => (v.scale > 1 ? { scale: 1, x: 0, y: 0 } : { scale: 2.5, x: -p.x * 1.5, y: -p.y * 1.5 }));
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('dblclick', onDouble);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('dblclick', onDouble);
    };
  }, [area, zoomAt]);

  return {
    scale: view.scale,
    zoomed: view.scale > 1,
    reset,
    zoomBy: (factor: number) => zoomAt(factor, 0, 0),
    style: { transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transformOrigin: 'center', transition: pointers.current.size ? 'none' : 'transform 0.12s ease-out' },
  };
}
