import { useEffect, useState } from 'react';
import { prefersReducedMotion } from './Confetti';

/** Rolls a number up from 0 (or down to a negative), with a sign: "+100". Ends on exactly `to`. */
export function CountUp({ to, ms = 650 }: { to: number; ms?: number }) {
  const [value, setValue] = useState(prefersReducedMotion() ? to : 0);

  useEffect(() => {
    if (to === 0 || prefersReducedMotion()) {
      setValue(to);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      setValue(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);

  return <>{value > 0 ? `+${value}` : value}</>;
}
