// Crop, rotate and mirror a picture. The result is saved as a list of edits on the server, which keeps the
// original file untouched.
import { useRef, useState } from 'react';
import { mdiClose, mdiCropFree, mdiFlipHorizontal, mdiFlipVertical, mdiRotateLeft, mdiRotateRight } from '@mdi/js';
import { saveEdits, thumbnailUrl, type EditAction } from '../../api/assets';
import type { Asset } from '../../api/types';
import { useElementSize } from '../../hooks/useElementWidth';
import { useRun } from '../../hooks/useRun';
import { t } from '../../i18n';
import { cx } from '../../lib/cx';
import { clamp } from '../../lib/format';
import { Button, IconButton } from '../ui/Button';

interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
} // fractions of the original picture
const FULL: Crop = { x: 0, y: 0, w: 1, h: 1 };
const ASPECTS: Array<{ label: string; value: number | null | 'original' }> = [
  { label: 'Free', value: null },
  { label: 'Original', value: 'original' },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:2', value: 3 / 2 },
  { label: '16:9', value: 16 / 9 },
];

type Drag = { mode: 'move' | 'nw' | 'ne' | 'sw' | 'se'; startX: number; startY: number; crop: Crop } | null;

export default function PhotoEditor({ asset, onClose, onSaved }: { asset: Asset; onClose: () => void; onSaved: () => void }) {
  const run = useRun();
  const area = useRef<HTMLDivElement>(null);
  const { width: aw, height: ah } = useElementSize(area);
  const [crop, setCrop] = useState<Crop>(FULL);
  const [cropping, setCropping] = useState(false);
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [mirrorH, setMirrorH] = useState(false);
  const [mirrorV, setMirrorV] = useState(false);
  const [aspect, setAspect] = useState<number | null | 'original'>(null);
  const drag = useRef<Drag>(null);
  const frame = useRef<HTMLDivElement>(null);

  const iw = asset.width ?? 1;
  const ih = asset.height ?? 1;
  const dirty = crop !== FULL || rotation !== 0 || mirrorH || mirrorV;

  // --- layout: the area shows either the whole picture (while cropping) or the cropped result ---
  const cw = cropping ? iw : crop.w * iw;
  const ch = cropping ? ih : crop.h * ih;
  const swapped = !cropping && rotation % 180 !== 0;
  const shownW = swapped ? ch : cw;
  const shownH = swapped ? cw : ch;
  const fit = Math.min(aw / shownW, ah / shownH, 1e9) * 0.92 || 0;
  const outerW = shownW * fit;
  const outerH = shownH * fit;

  // --- crop box dragging (only while cropping) ---
  const setAspectTo = (value: number | null | 'original') => {
    setAspect(value);
    const target = value === 'original' ? iw / ih : value;
    if (!target) return;
    // Largest centred box of that aspect inside the current box.
    const boxW = crop.w * iw;
    const boxH = crop.h * ih;
    let w = boxW;
    let h = w / target;
    if (h > boxH) {
      h = boxH;
      w = h * target;
    }
    setCrop({ x: crop.x + (crop.w - w / iw) / 2, y: crop.y + (crop.h - h / ih) / 2, w: w / iw, h: h / ih });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !frame.current) return;
    const rect = frame.current.getBoundingClientRect();
    const dx = (e.clientX - d.startX) / rect.width;
    const dy = (e.clientY - d.startY) / rect.height;
    let { x, y, w, h } = d.crop;
    if (d.mode === 'move') {
      x = clamp(x + dx, 0, 1 - w);
      y = clamp(y + dy, 0, 1 - h);
    } else {
      const left = d.mode.includes('w');
      const top = d.mode.includes('n');
      const nx = left ? clamp(x + dx, 0, x + w - 0.05) : x;
      const ny = top ? clamp(y + dy, 0, y + h - 0.05) : y;
      const nr = left ? x + w : clamp(x + w + dx, x + 0.05, 1);
      const nb = top ? y + h : clamp(y + h + dy, y + 0.05, 1);
      w = nr - nx;
      h = nb - ny;
      const target = aspect === 'original' ? iw / ih : aspect;
      if (target) h = (w * iw) / target / ih; // keep the chosen proportions
      x = nx;
      y = top ? nb - h : ny;
      if (y < 0 || y + h > 1) return;
    }
    setCrop({ x, y, w, h });
  };

  const save = async () => {
    const edits: EditAction[] = [];
    if (crop !== FULL) edits.push({ action: 'crop', parameters: { x: Math.round(crop.x * iw), y: Math.round(crop.y * ih), width: Math.round(crop.w * iw), height: Math.round(crop.h * ih) } });
    if (rotation) edits.push({ action: 'rotate', parameters: { angle: rotation as 90 | 180 | 270 } });
    if (mirrorH) edits.push({ action: 'mirror', parameters: { axis: 'horizontal' } });
    if (mirrorV) edits.push({ action: 'mirror', parameters: { axis: 'vertical' } });
    const result = await run(() => saveEdits(asset.id, edits), { success: t('Edits saved'), invalidate: [['asset'], ['timeline']] });
    if (result.ok) onSaved();
  };

  const handle = (mode: 'nw' | 'ne' | 'sw' | 'se', pos: string) => (
    <span
      key={mode}
      className={cx('absolute size-4 rounded-full border-2 border-white bg-primary', pos)}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { mode, startX: e.clientX, startY: e.clientY, crop };
      }}
    />
  );

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-black text-white md:flex-row">
      <div ref={area} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        {cropping ? (
          <div ref={frame} className="relative touch-none" style={{ width: outerW, height: outerH }} onPointerMove={onPointerMove} onPointerUp={() => (drag.current = null)}>
            <img src={thumbnailUrl(asset.id, 'preview')} alt="" draggable={false} className="size-full object-fill" />
            <div className="absolute inset-0 bg-black/50" style={{ clipPath: `polygon(0 0,100% 0,100% 100%,0 100%,0 0,${crop.x * 100}% ${crop.y * 100}%,${crop.x * 100}% ${(crop.y + crop.h) * 100}%,${(crop.x + crop.w) * 100}% ${(crop.y + crop.h) * 100}%,${(crop.x + crop.w) * 100}% ${crop.y * 100}%,${crop.x * 100}% ${crop.y * 100}%)` }} />
            <div
              className="absolute cursor-move border-2 border-white"
              style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                drag.current = { mode: 'move', startX: e.clientX, startY: e.clientY, crop };
              }}
            >
              {handle('nw', '-top-2 -left-2 cursor-nwse-resize')}
              {handle('ne', '-top-2 -right-2 cursor-nesw-resize')}
              {handle('sw', '-bottom-2 -left-2 cursor-nesw-resize')}
              {handle('se', '-right-2 -bottom-2 cursor-nwse-resize')}
            </div>
          </div>
        ) : (
          // Result preview: an inner box (unrotated shape) is rotated/mirrored inside the outer box (result shape).
          <div style={{ width: outerW, height: outerH }} className="relative flex items-center justify-center">
            <div
              className="relative overflow-hidden"
              style={{
                width: swapped ? outerH : outerW,
                height: swapped ? outerW : outerH,
                transform: `rotate(${rotation}deg) scale(${mirrorH ? -1 : 1}, ${mirrorV ? -1 : 1})`,
              }}
            >
              <img
                src={thumbnailUrl(asset.id, 'preview')}
                alt=""
                draggable={false}
                className="absolute max-w-none"
                style={{ width: `${100 / crop.w}%`, height: `${100 / crop.h}%`, left: `${(-crop.x / crop.w) * 100}%`, top: `${(-crop.y / crop.h) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <aside className="flex w-full shrink-0 flex-col gap-4 bg-bg p-4 text-fg md:w-72">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t('Edit')}</h2>
          <IconButton path={mdiClose} label={t('Close')} onClick={onClose} />
        </div>
        <div className="flex gap-1">
          <IconButton path={mdiRotateLeft} label={t('Rotate left')} onClick={() => setRotation((r) => (r + 270) % 360)} />
          <IconButton path={mdiRotateRight} label={t('Rotate right')} onClick={() => setRotation((r) => (r + 90) % 360)} />
          <IconButton path={mdiFlipHorizontal} label={t('Mirror horizontally')} active={mirrorH} onClick={() => setMirrorH(!mirrorH)} />
          <IconButton path={mdiFlipVertical} label={t('Mirror vertically')} active={mirrorV} onClick={() => setMirrorV(!mirrorV)} />
          <IconButton path={mdiCropFree} label={t('Crop')} active={cropping} onClick={() => setCropping(!cropping)} />
        </div>
        {cropping && (
          <div className="flex flex-wrap gap-2">
            {ASPECTS.map((a) => (
              <button key={a.label} onClick={() => setAspectTo(a.value)} className={cx('rounded-full border border-line px-3 py-1 text-xs', aspect === a.value && 'border-primary bg-primary/15 text-primary')}>
                {t(a.label)}
              </button>
            ))}
            <Button size="sm" variant="ghost" onClick={() => (setCrop(FULL), setAspect(null))}>
              {t('Reset crop')}
            </Button>
          </div>
        )}
        <div className="mt-auto flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button disabled={!dirty} onClick={save}>
            {t('Save')}
          </Button>
        </div>
      </aside>
    </div>
  );
}
