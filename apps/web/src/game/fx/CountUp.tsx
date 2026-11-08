import { useEffect, useState } from 'react';
import { prefersReducedMotion } from './Confetti';

/**
 * Rolls a number from `from` (default 0) to `to`, after `delay` ms. Signed ("+100") unless `signed` is false,
 * for totals. Ends on exactly `to`.
 */
export function CountUp({ to, from = 0, ms = 650, delay = 0, signed = true }: { to: number; from?: number; ms?: number; delay?: number; signed?: boolean }) {
  const [value, setValue] = useState(prefersReducedMotion() ? to : from);

  useEffect(() => {
    if (to === from || prefersReducedMotion()) {
      setValue(to);
      return;
    }
    setValue(from);
    let raf = 0;
    let t0 = 0;
    const step = (now: number) => {
      if (!t0) t0 = now;
      const p = Math.min(1, (now - t0) / ms);
      setValue(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    const timer = setTimeout(() => (raf = requestAnimationFrame(step)), delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [to, from, ms, delay]);

  return <>{signed && value > 0 ? `+${value}` : value}</>;
}
