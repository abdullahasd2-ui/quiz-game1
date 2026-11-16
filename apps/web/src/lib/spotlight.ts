// A soft light that follows the pointer over interactive cards (`.q-spot`): one listener for the whole page that
// only writes two CSS variables on the card under the pointer, so it costs nothing when nothing is hovered.
import { useEffect } from 'react';

export function useCardSpotlight() {
  useEffect(() => {
    if (!matchMedia('(hover: hover)').matches) return; // touch screens: no hover light
    let raf = 0;
    let pending: PointerEvent | null = null;
    const apply = () => {
      raf = 0;
      const e = pending;
      if (!e) return;
      const el = (e.target as Element | null)?.closest?.<HTMLElement>('.q-spot');
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    const onMove = (e: PointerEvent) => {
      pending = e;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);
}
