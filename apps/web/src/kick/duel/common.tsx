import type { DuelState, DuelTeam } from '@quiz/shared';
import { useMemo } from 'react';

/** The two teams' colours as hex (for SVG): blue for the host's channel, red for the guest's. */
export const HEX = {
  a: { light: '#5cc8ff', dark: '#1d4ed8' },
  b: { light: '#ff6b8b', dark: '#be123c' },
} as const;

export const teamLabel = (s: DuelState, t: DuelTeam) => s.channels[t] || (t === 'a' ? 'قناتك' : 'الخصم');

/** Points on a ring (with a little jitter) for spark bursts. */
export function sparks(n: number, radius: number) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + ((i * 37) % 10) / 20;
    const r = radius * (0.6 + ((i * 53) % 10) / 25);
    return { x: Math.round(Math.cos(a) * r), y: Math.round(Math.sin(a) * r) };
  });
}

/** The night sky behind a world: stars, drifting clouds and rising embers (colour set by --heat / --dusk on the stage). */
export function Sky({ embers = 10 }: { embers?: number }) {
  const list = useMemo(
    () => Array.from({ length: embers }, (_, i) => ({ left: `${(i * 97) % 100}%`, d: `${4 + ((i * 7) % 5)}s`, delay: `${-((i * 13) % 9) * 0.6}s`, x: `${((i * 29) % 60) - 30}px` })),
    [embers],
  );
  return (
    <>
      <div className="duel-sky" />
      <div className="duel-stars" />
      {/* Moon and distant mountains: depth behind the battlefield. */}
      <div className="absolute top-[8%] left-1/2 -z-[1] aspect-square w-[5%] min-w-8 -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_35%_35%,#fffbe8,#e9dcb8_55%,#b9a982)] opacity-80 shadow-[0_0_60px_10px_rgba(255,240,200,0.25)]" />
      <svg viewBox="0 0 400 100" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 -z-[1] h-[45%] w-full" aria-hidden>
        <path d="M0 100 L0 62 L40 40 L70 58 L110 28 L150 55 L190 35 L230 60 L270 30 L310 52 L350 34 L400 58 L400 100 Z" fill="#1a1440" opacity="0.8" />
        <path d="M0 100 L0 75 L50 58 L95 72 L140 55 L200 74 L250 56 L300 72 L350 60 L400 74 L400 100 Z" fill="#140f33" />
      </svg>
      <div className="duel-cloud" style={{ top: '8%', ['--d' as string]: '52s', ['--delay' as string]: '-12s' }} />
      <div className="duel-cloud" style={{ top: '22%', ['--d' as string]: '68s', ['--delay' as string]: '-40s' }} />
      <div className="duel-cloud" style={{ top: '4%', ['--d' as string]: '80s', ['--delay' as string]: '-66s' }} />
      {list.map((e, i) => (
        <span key={i} className="duel-ember" style={{ left: e.left, ['--d' as string]: e.d, ['--delay' as string]: e.delay, ['--x' as string]: e.x }} />
      ))}
    </>
  );
}
