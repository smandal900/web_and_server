import { useEffect, useRef } from 'react';

/** Draws a QR code for `value`. The `qrcode` library is downloaded only when this component first shows. */
export default function Qrcode({ value, size = 200 }: { value: string; size?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let current = true;
    import('qrcode').then((QR) => {
      if (current && canvas.current) QR.toCanvas(canvas.current, value, { width: size, margin: 1 });
    });
    return () => {
      current = false;
    };
  }, [value, size]);
  return <canvas ref={canvas} width={size} height={size} className="rounded-lg bg-white" aria-label="QR code" />;
}
