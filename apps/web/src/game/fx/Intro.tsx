import { useEffect, useState } from 'react';
import { prefersReducedMotion } from './Confetti';

/**
 * A short logo moment when the game opens: «جاوب» and «بادل» swing in from both sides, «أو» pops between them,
 * the bomb drops in, then it all fades into the home screen. About 2 seconds; tap to skip; once per visit.
 */
export function Intro() {
  const [show, setShow] = useState(() => {
    if (prefersReducedMotion()) return false;
    try {
      if (sessionStorage.getItem('quiz:intro')) return false;
      sessionStorage.setItem('quiz:intro', '1');
    } catch {
      /* private mode: show it */
    }
    return true;
  });
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => setShow(false), 2100);
    return () => clearTimeout(t);
  }, [show]);
  if (!show) return null;
  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-q-bg animate-intro-out"
      onClick={() => setShow(false)}
      role="presentation"
    >
      <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 45%, rgba(168,85,247,0.25), rgba(56,189,248,0.08) 40%, transparent 70%)' }} />
      <div className="relative text-center">
        <div className="flex items-center justify-center gap-3 text-6xl font-black sm:text-7xl" dir="rtl">
          <span className="text-q-purple [animation:intro-left_0.7s_cubic-bezier(0.2,0.9,0.3,1)_both]">جاوب</span>
          <span className="text-white [animation:pop-in_0.4s_cubic-bezier(0.34,1.56,0.64,1)_0.45s_both]">أو</span>
          <span className="text-q-cyan [animation:intro-right_0.7s_cubic-bezier(0.2,0.9,0.3,1)_0.1s_both]">بادل</span>
        </div>
        <div className="mt-4 text-5xl [animation:fx-drop_0.5s_cubic-bezier(0.34,1.56,0.64,1)_0.75s_both]">💣</div>
        <div className="mx-auto mt-5 h-1 w-40 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-linear-to-l from-q-orange to-q-gold [animation:intro-bar_1.4s_ease-in-out_0.3s_both]" />
        </div>
      </div>
    </div>
  );
}
