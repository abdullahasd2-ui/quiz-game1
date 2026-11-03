import { useEffect, useRef } from 'react';

const COLORS = ['#f7c948', '#ff6b35', '#3498db', '#e74c3c', '#27ae60', '#a855f7', '#38bdf8'];

type Piece = { x: number; y: number; vx: number; vy: number; w: number; h: number; rot: number; vr: number; color: string };

export const prefersReducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A confetti burst from the lower corners, like the result scene of the promo video. Draws once, then goes quiet. */
export function Confetti({ count = 110, big = false }: { count?: number; big?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const c = canvas?.getContext('2d');
    if (!canvas || !c || prefersReducedMotion()) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = (canvas.width = Math.round(innerWidth * dpr));
    const H = (canvas.height = Math.round(innerHeight * dpr));
    const gravity = H * 0.0022;
    const pieces: Piece[] = Array.from({ length: big ? count * 2 : count }, (_, i) => {
      const fromLeft = i % 2 === 0;
      const angle = ((fromLeft ? -62 : -118) + (Math.random() - 0.5) * 44) * (Math.PI / 180);
      const speed = H * (0.016 + Math.random() * 0.016);
      return {
        x: fromLeft ? W * 0.05 : W * 0.95,
        y: H * 0.96,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        w: (5 + Math.random() * 6) * dpr,
        h: (8 + Math.random() * 8) * dpr,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.35,
        color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? '#f7c948',
      };
    });

    let raf = 0;
    let last = performance.now();
    const t0 = last;
    const frame = (now: number) => {
      const k = Math.min(2.5, (now - last) / 16.67);
      last = now;
      c.clearRect(0, 0, W, H);
      let alive = false;
      for (const p of pieces) {
        p.vy += gravity * k;
        p.vx *= 0.992;
        p.x += p.vx * k;
        p.y += p.vy * k;
        p.rot += p.vr * k;
        if (p.y < H + 40 * dpr) alive = true;
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.rot);
        c.fillStyle = p.color;
        c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.rot * 1.3)) + 2);
        c.restore();
      }
      if (alive && now - t0 < 4500) raf = requestAnimationFrame(frame);
      else c.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [count, big]);

  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-[60] size-full" aria-hidden />;
}
