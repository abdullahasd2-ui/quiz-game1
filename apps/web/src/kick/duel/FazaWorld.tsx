// «الفزعة»: an energy race. Every right answer from a chat is a «فزعة» that pushes its lightning orb forward;
// the lane crackles while it charges, and the team that reaches the goal is struck by lightning and takes the round.
import { type DuelState, type DuelTeam } from '@quiz/shared';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { HEX, sparks, teamLabel } from './common';

export function FazaWorld({ s, big }: { s: DuelState; big: boolean }) {
  const r = s.round;
  const key = `${s.session}:${s.rounds}`;
  const res = s.phase === 'result' || s.phase === 'over' ? r?.result : undefined;
  // A «+1 فزعة!» pops each time a team's live count goes up.
  const prev = useRef<Record<DuelTeam, number>>({ a: 0, b: 0 });
  const [boost, setBoost] = useState<Record<DuelTeam, number>>({ a: 0, b: 0 });
  useEffect(() => {
    const live = r?.live ?? { a: 0, b: 0 };
    (['a', 'b'] as const).forEach((t) => {
      if (live[t] > prev.current[t]) setBoost((b) => ({ ...b, [t]: b[t] + 1 }));
    });
    prev.current = { ...live };
  }, [r?.live.a, r?.live.b]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={cn('duel-stage border border-yellow-300/15 bg-[#0b0a1f] p-3', big && 'p-6')}>
      <div className="faza-grid" />
      <div className={cn('mb-2 text-center font-black text-yellow-200/90', big ? 'text-2xl' : 'text-xs')}>⚡ كل جواب صح فزعة تدفع شحنة فريقك للهدف</div>
      <div className="grid gap-3">
        {(['a', 'b'] as const).map((t) => {
          const goal = r?.goal?.[t] ?? 1;
          const got = Math.min(goal, r?.live[t] ?? 0);
          const pct = r ? (got / goal) * 100 : 0;
          const color = HEX[t].light;
          const won = res?.winner === t;
          return (
            <div key={t} className="relative">
              <div className={cn('mb-1 flex items-center justify-between gap-2 font-black', big ? 'text-2xl' : 'text-sm')}>
                <span className="truncate" style={{ color }} dir="ltr">
                  ⚡ {teamLabel(s, t)}
                </span>
                {/* Rounds won */}
                <span className="flex gap-1" aria-label={`فاز ${s.wins[t]} جولات`}>
                  {Array.from({ length: s.settings.fazaWins }, (_, i) => (
                    <span
                      key={i}
                      className={cn('grid place-items-center rounded-md border transition-all', big ? 'size-9 text-lg' : 'size-5 text-[10px]', i < s.wins[t] ? 'duel-pop border-transparent text-black' : 'border-white/15 text-white/20')}
                      style={i < s.wins[t] ? { background: `linear-gradient(135deg, #fde047, ${color})` } : undefined}
                    >
                      ⚡
                    </span>
                  ))}
                </span>
              </div>
              <div className={cn('relative overflow-visible rounded-full border border-white/10 bg-black/50', big ? 'h-16' : 'h-9')}>
                {/* Charged part, with a moving energy trail */}
                <div
                  className="faza-trail absolute inset-y-0 start-0 rounded-full transition-[width] duration-500"
                  style={{ width: `${pct}%`, backgroundImage: `repeating-linear-gradient(110deg, ${color}cc 0 14px, ${HEX[t].dark}cc 14px 28px)`, boxShadow: `0 0 24px -4px ${color}` }}
                />
                {/* Goal */}
                <div className={cn('absolute inset-y-0 end-1 grid place-items-center', big ? 'text-4xl' : 'text-xl')}>🏁</div>
                {/* The orb */}
                {r && (
                  <div className="faza-runner absolute top-1/2" style={{ insetInlineStart: `clamp(0px, calc(${pct}% - ${big ? 32 : 18}px), calc(100% - ${big ? 64 : 36}px))`, transform: 'translateY(-50%)' }}>
                    <div className={cn('faza-orb grid place-items-center rounded-full', big ? 'size-16 text-3xl' : 'size-9 text-lg')} style={{ background: `radial-gradient(circle at 35% 30%, #fff, #fde047 35%, ${color})`, boxShadow: `0 0 30px ${color}` }}>
                      ⚡
                    </div>
                    {boost[t] > 0 && s.phase === 'question' && (
                      <div key={boost[t]} className="pointer-events-none absolute inset-0">
                        {sparks(10, big ? 70 : 36).map((p, i) => (
                          <span key={i} className="duel-burst" style={{ left: '50%', top: '50%' }}>
                            <i style={{ ['--x' as string]: `${p.x}px`, ['--y' as string]: `${p.y}px`, ['--c' as string]: i % 2 ? '#fde047' : color, ['--delay' as string]: '0s' }} />
                          </span>
                        ))}
                        <span className={cn('duel-float-up absolute -top-8 start-1/2 -translate-x-1/2 whitespace-nowrap font-black text-yellow-200', big ? 'text-2xl' : 'text-xs')}>+1 فزعة!</span>
                      </div>
                    )}
                  </div>
                )}
                {/* The winner is struck by lightning. */}
                {won && (
                  <svg key={key} viewBox="0 0 400 100" preserveAspectRatio="none" className="pointer-events-none absolute -inset-y-6 inset-x-0 h-[calc(100%+3rem)] w-full" aria-hidden>
                    <path className="faza-bolt" d="M210 -10 L190 40 L215 42 L180 110" fill="none" stroke="#fef08a" strokeWidth="5" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 8px #fde047)' }} />
                    <path className="faza-bolt" d="M120 -10 L105 30 L125 32 L100 110" fill="none" stroke="#fff" strokeWidth="3" style={{ ['--delay' as string]: '0.15s' }} />
                    <path className="faza-bolt" d="M300 -10 L285 35 L305 37 L280 110" fill="none" stroke="#fff" strokeWidth="3" style={{ ['--delay' as string]: '0.25s' }} />
                  </svg>
                )}
              </div>
              <div className={cn('mt-1 flex justify-between font-black tabular-nums', big ? 'text-xl' : 'text-[11px]')}>
                <span className="text-white/60">{r ? `${got} / ${goal} جواب صح` : `الهدف ${s.settings.fazaGoalPct}٪ من لاعبي الفريق`}</span>
                {won && <span className="duel-pop text-yellow-200">🏆 فزعوا وأخذوا الجولة!</span>}
                {res && !res.winner && t === 'b' && <span className="text-white/50">تعادل — ما أحد أخذ الجولة</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
