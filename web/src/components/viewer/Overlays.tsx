// Layers drawn over a picture: detected faces and recognised text. Everything is positioned in
// percent of the picture, so it stays aligned while the picture is zoomed.
import { useQuery } from '@tanstack/react-query';
import { getOcr } from '../../api/assets';
import type { Asset } from '../../api/types';

/** Boxes around the faces found in the picture, with the person's name on hover. */
export function FaceOverlay({ asset, onPerson }: { asset: Asset; onPerson?: (personId: string) => void }) {
  const faces = (asset.people ?? []).flatMap((p) => (p.faces ?? []).map((f) => ({ ...f, person: p })));
  return (
    <>
      {faces.map((f) => (
        <button
          key={f.id}
          onClick={() => f.person && onPerson?.(f.person.id)}
          title={f.person?.name || 'Unknown person'}
          className="group absolute rounded-md border-2 border-white/0 hover:border-white/90"
          style={{
            left: `${(f.boundingBoxX1 / f.imageWidth) * 100}%`,
            top: `${(f.boundingBoxY1 / f.imageHeight) * 100}%`,
            width: `${((f.boundingBoxX2 - f.boundingBoxX1) / f.imageWidth) * 100}%`,
            height: `${((f.boundingBoxY2 - f.boundingBoxY1) / f.imageHeight) * 100}%`,
          }}
        >
          <span className="absolute -bottom-6 left-1/2 hidden -translate-x-1/2 rounded bg-black/70 px-2 py-0.5 text-xs whitespace-nowrap text-white group-hover:block">{f.person?.name || 'Unknown'}</span>
        </button>
      ))}
    </>
  );
}

/** Text found by OCR, shown as selectable boxes over the places where it appears in the picture. */
export function OcrOverlay({ assetId }: { assetId: string }) {
  const ocr = useQuery({ queryKey: ['ocr', assetId], queryFn: () => getOcr(assetId), retry: false });
  return (
    <>
      {(ocr.data ?? []).map((box, i) => {
        const xs = [box.x1, box.x2, box.x3, box.x4];
        const ys = [box.y1, box.y2, box.y3, box.y4];
        const left = Math.min(...xs) * 100;
        const top = Math.min(...ys) * 100;
        return (
          <div
            key={i}
            className="absolute flex items-center justify-center overflow-hidden rounded border border-yellow-300 bg-black/60 text-center text-[0.7em] leading-none text-white select-text"
            style={{ left: `${left}%`, top: `${top}%`, width: `${(Math.max(...xs) - Math.min(...xs)) * 100}%`, height: `${(Math.max(...ys) - Math.min(...ys)) * 100}%` }}
          >
            {box.text}
          </div>
        );
      })}
    </>
  );
}
