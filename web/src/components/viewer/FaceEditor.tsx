// Draw a box around a face the automatic detection missed, then say who it is.
import { useRef, useState } from 'react';
import { mdiClose } from '@mdi/js';
import { useQuery } from '@tanstack/react-query';
import { thumbnailUrl, personThumbnailUrl } from '../../api/assets';
import { createFace, createPerson, getPeople } from '../../api/library';
import type { Asset } from '../../api/types';
import { useElementSize } from '../../hooks/useElementWidth';
import { useRun } from '../../hooks/useRun';
import { t } from '../../i18n';
import { Button, IconButton } from '../ui/Button';
import { TextField } from '../ui/Fields';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
} // fractions of the picture (0..1)

export default function FaceEditor({ asset, onClose, onSaved }: { asset: Asset; onClose: () => void; onSaved: () => void }) {
  const area = useRef<HTMLDivElement>(null);
  const { width: aw, height: ah } = useElementSize(area);
  const run = useRun();
  const [box, setBox] = useState<Box | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [search, setSearch] = useState('');
  const people = useQuery({ queryKey: ['people', 'all'], queryFn: () => getPeople({ withHidden: false }), retry: false });

  const ratio = asset.width && asset.height ? asset.width / asset.height : 1.5;
  const w = Math.min(aw, ah * ratio);
  const h = w / ratio;
  const frame = useRef<HTMLDivElement>(null);

  const point = (e: React.PointerEvent) => {
    const r = frame.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };

  const assign = async (personId: string | null, newName?: string) => {
    if (!box) return;
    const result = await run(
      async () => {
        const id = personId ?? (await createPerson({ name: newName ?? '' })).id;
        const iw = asset.width ?? 1;
        const ih = asset.height ?? 1;
        return createFace({ assetId: asset.id, personId: id, imageWidth: iw, imageHeight: ih, x: Math.round(box.x * iw), y: Math.round(box.y * ih), width: Math.round(box.w * iw), height: Math.round(box.h * ih) });
      },
      { success: t('Face added'), invalidate: [['asset'], ['people']] },
    );
    if (result.ok) onSaved();
  };

  const shown = (people.data?.people ?? []).filter((p) => p.name.toLowerCase().includes(search.toLowerCase())).slice(0, 30);

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-black/90 text-white md:flex-row">
      <div ref={area} className="relative flex min-h-0 flex-1 items-center justify-center">
        <div
          ref={frame}
          className="relative touch-none cursor-crosshair"
          style={{ width: w || undefined, height: h || undefined }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            start.current = point(e);
            setBox({ ...start.current, w: 0, h: 0 });
          }}
          onPointerMove={(e) => {
            if (!start.current) return;
            const p = point(e);
            setBox({ x: Math.min(start.current.x, p.x), y: Math.min(start.current.y, p.y), w: Math.abs(p.x - start.current.x), h: Math.abs(p.y - start.current.y) });
          }}
          onPointerUp={() => (start.current = null)}
        >
          <img src={thumbnailUrl(asset.id, 'preview')} alt="" draggable={false} className="size-full object-contain" />
          {box && <div className="absolute rounded-md border-2 border-white bg-white/10" style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%` }} />}
        </div>
      </div>

      <aside className="flex max-h-[45%] w-full shrink-0 flex-col gap-3 overflow-y-auto bg-bg p-4 text-fg md:max-h-full md:w-80">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t('Tag a person')}</h2>
          <IconButton path={mdiClose} label={t('Close')} onClick={onClose} />
        </div>
        <p className="text-sm text-muted">{box && box.w > 0.01 ? t('Choose who this is, or create a new person.') : t('Drag on the picture to mark the face.')}</p>
        <TextField placeholder={t('Search people')} value={search} onChange={setSearch} />
        <ul className="grid grid-cols-3 gap-2">
          {shown.map((p) => (
            <li key={p.id}>
              <button disabled={!box || box.w < 0.01} onClick={() => assign(p.id)} className="flex w-full flex-col items-center gap-1 rounded-lg p-1 hover:bg-panel disabled:opacity-40">
                <img src={personThumbnailUrl(p.id)} alt="" className="size-14 rounded-full bg-panel object-cover" />
                <span className="w-full truncate text-xs">{p.name || t('Unknown')}</span>
              </button>
            </li>
          ))}
        </ul>
        {search.trim() && (
          <Button variant="outline" disabled={!box || box.w < 0.01} onClick={() => assign(null, search.trim())}>
            {t('Create "{name}"', { name: search.trim() })}
          </Button>
        )}
      </aside>
    </div>
  );
}
