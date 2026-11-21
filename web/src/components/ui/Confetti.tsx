import { useEffect, useRef } from 'react';

const COLORS = ['#fa2921', '#ed79b5', '#ffb400', '#1e83f7', '#18c249'];

/** A short burst of falling confetti (used for birthday memories). Draws on a canvas for about 4 seconds. */
export default function Confetti() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current!;
    const ctx = el.getContext('2d')!;
    el.width = el.offsetWidth;
    el.height = el.offsetHeight;
    const pieces = Array.from({ length: 120 }, () => ({
      x: Math.random() * el.width,
      y: -Math.random() * el.height,
      size: 5 + Math.random() * 7,
      speed: 2 + Math.random() * 3,
      drift: (Math.random() - 0.5) * 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));
    let frame = 0;
    const start = performance.now();
    const draw = (now: number) => {
      ctx.clearRect(0, 0, el.width, el.height);
      for (const p of pieces) {
        p.y += p.speed;
        p.x += p.drift;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size * 0.6);
      }
      if (now - start < 4000) frame = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, el.width, el.height);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);
  return <canvas ref={canvas} className="pointer-events-none absolute inset-0 z-20 size-full" />;
}
