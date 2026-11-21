// Choose a picture, move/zoom it inside a circle, and upload the square result as the profile picture.
import { useEffect, useRef, useState } from 'react';
import { uploadAvatar } from '../../api/core';
import { useRun } from '../../hooks/useRun';
import { t } from '../../i18n';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

const BOX = 280; // size of the preview square on screen
const OUT = 512; // size of the uploaded picture

export default function AvatarModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const run = useRun();
  const input = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<HTMLImageElement>();
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => input.current?.click(), []);

  // Scale so the shorter side exactly fills the box at zoom 1.
  const base = image ? BOX / Math.min(image.width, image.height) : 1;
  const scale = base * zoom;

  const choose = (file?: File) => {
    if (!file) return;
    const img = new Image();
    img.onload = () => (setImage(img), setOffset({ x: 0, y: 0 }), setZoom(1));
    img.src = URL.createObjectURL(file);
  };

  const save = async () => {
    if (!image) return;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = OUT;
    const ctx = canvas.getContext('2d')!;
    const k = OUT / BOX;
    ctx.drawImage(image, (BOX / 2 - (image.width * scale) / 2 + offset.x) * k, (BOX / 2 - (image.height * scale) / 2 + offset.y) * k, image.width * scale * k, image.height * scale * k);
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
    const r = await run(() => uploadAvatar(blob), { success: t('Profile picture changed') });
    if (r.ok) onSaved();
  };

  return (
    <Modal
      title={t('Profile picture')}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={() => input.current?.click()}>
            {t('Choose file')}
          </Button>
          <Button disabled={!image} onClick={save}>
            {t('Save')}
          </Button>
        </>
      }
    >
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => choose(e.target.files?.[0])} />
      <div className="flex flex-col items-center gap-4">
        <div
          className="relative touch-none overflow-hidden rounded-full bg-panel"
          style={{ width: BOX, height: BOX }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            const dx = e.clientX - drag.current.x;
            const dy = e.clientY - drag.current.y;
            drag.current = { x: e.clientX, y: e.clientY };
            setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
          }}
          onPointerUp={() => (drag.current = null)}
        >
          {image && <img src={image.src} alt="" draggable={false} className="absolute max-w-none" style={{ width: image.width * scale, height: image.height * scale, left: BOX / 2 - (image.width * scale) / 2 + offset.x, top: BOX / 2 - (image.height * scale) / 2 + offset.y }} />}
        </div>
        <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label={t('Zoom')} className="w-full" />
      </div>
    </Modal>
  );
}
