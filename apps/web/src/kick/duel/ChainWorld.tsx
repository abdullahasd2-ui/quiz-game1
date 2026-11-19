// «السلسلة»: each team's chain is made of real interlocking links. A right answer drops a new link in with a swing,
// the multiplier medallion grows, a full chain (×5) glows gold, and a wrong answer blows the links apart.
import { CHAIN_MAX, type DuelState, type DuelTeam } from '@quiz/shared';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { HEX, sparks, teamLabel } from './common';

const LINK_W = 46;

/** One link: a rounded ring seen from the front (even) or from the side (odd), so neighbours interlock. */
function Link({ i, color, on, fresh, gold }: { i: number; color: string; on: boolean; fresh: boolean; gold: boolean }) {
  const x = i * (LINK_W - 12);
  const side = i % 2 === 1;
  const stroke = gold ? '#f7c948' : on ? color : 'rgba(255,255,255,0.13)';
  return (
    <g transform={`translate(${x} 0)`}>
      <g className={cn('chain-link', fresh && 'new', on && 'chain-hot')} style={{ ['--c' as string]: gold ? '#f7c948' : color }}>
        {side ? (
          <rect x="8" y="20" width={LINK_W - 16} height="20" rx="10" fill="none" stroke={stroke} strokeWidth="7" />
        ) : (
          <rect x="2" y="10" width={LINK_W - 4} height="40" rx="18" fill="none" stroke={stroke} strokeWidth="8" />
        )}
        {on && !side && <rect x="7" y="14" width={LINK_W - 22} height="6" rx="3" fill="#fff" opacity="0.35" />}
      </g>
    </g>
  );
}

export function ChainWorld({ s, big }: { s: DuelState; big: boolean }) {
  const res = s.phase === 'result' || s.phase === 'over' ? s.round?.result : undefined;
  const last = s.round?.turn;
  const key = `${s.session}:${s.rounds}`;
  // The chain each team had before the last result, to blow apart when it breaks.
  const before = useRef<Record<DuelTeam, number>>({ ...s.chain });
  const [broken, setBroken] = useState<{ team: DuelTeam; n: number; key: string } | null>(null);
  useEffect(() => {
    if (res?.broke && last) setBroken({ team: last, n: before.current[last], key });
    before.current = { ...s.chain };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="grid gap-3">
      {(['a', 'b'] as const).map((t) => {
        const n = s.chain[t];
        const turn = s.phase === 'question' && s.round?.turn === t;
        const gold = n >= CHAIN_MAX;
        const justGrew = res && last === t && (res.gained ?? 0) > 0;
        const color = HEX[t].light;
        const width = CHAIN_MAX * (LINK_W - 12) + 14;
        return (
          <div
            key={t}
            className={cn(
              'duel-stage flex items-center gap-3 border-2 bg-linear-to-l from-[#0d0b24] to-[#1a1440] p-3 transition-all duration-500 sm:gap-5',
              turn ? 'scale-[1.01]' : 'opacity-80',
              big && 'p-6',
            )}
            style={{ borderColor: turn ? color : 'rgba(255,255,255,0.08)', boxShadow: turn ? `0 0 40px -10px ${color}` : undefined }}
          >
            {turn && <div className="chain-shimmer" />}
            {/* Multiplier medallion */}
            <div className={cn('relative grid shrink-0 place-items-center', big ? 'size-32' : 'size-20')}>
              <svg viewBox="0 0 100 100" className="chain-medal absolute inset-0">
                <circle cx="50" cy="50" r="44" fill="none" stroke={gold ? '#f7c948' : color} strokeWidth="3" strokeDasharray="6 7" opacity="0.8" />
              </svg>
              <div className="absolute inset-2 rounded-full" style={{ background: `radial-gradient(circle at 35% 30%, ${gold ? '#fff1b8' : color}, ${gold ? '#b7791f' : HEX[t].dark})` }} />
              <div key={n} dir="ltr" className={cn('q-display relative text-black drop-shadow-[0_1px_0_rgba(255,255,255,0.5)] duel-pop', big ? 'text-5xl' : 'text-2xl')}>×{Math.min(CHAIN_MAX, n + 1)}</div>
            </div>

            <div className="min-w-0 flex-1">
              <div className={cn('mb-1 flex items-center justify-between gap-2 font-black', big ? 'text-2xl' : 'text-sm')}>
                <span className="truncate" style={{ color }} dir="ltr">
                  ⛓️ {teamLabel(s, t)}
                </span>
                <span className="text-white/70">{turn ? '🎯 دورهم يجاوبون' : gold ? '👑 سلسلة كاملة!' : n === 1 ? 'حلقة وحدة' : n === 2 ? 'حلقتين ورا بعض' : n ? `${n} حلقات ورا بعض` : 'السلسلة فاضية'}</span>
              </div>
              <div className="relative">
                <svg viewBox={`-4 0 ${width} 60`} className={cn('w-full', big ? 'h-24' : 'h-14')} aria-hidden>
                  {Array.from({ length: CHAIN_MAX }, (_, i) => (
                    <Link key={i} i={i} color={color} on={i < n} fresh={Boolean(justGrew) && i === n - 1} gold={gold} />
                  ))}
                </svg>
                {/* The broken links fly apart. */}
                {broken?.team === t && broken.key === key && (
                  <svg viewBox={`-4 0 ${width} 60`} className={cn('pointer-events-none absolute inset-0 w-full', big ? 'h-24' : 'h-14')} aria-hidden>
                    {Array.from({ length: broken.n }, (_, i) => {
                      const p = sparks(broken.n, 70)[i]!;
                      return (
                        <g key={i} transform={`translate(${i * (LINK_W - 12)} 0)`}>
                          <rect className="chain-shard" x="2" y="10" width={LINK_W - 4} height="40" rx="18" fill="none" stroke="#ff4d4d" strokeWidth="8" style={{ ['--x' as string]: `${p.x}px`, ['--y' as string]: `${p.y - 30}px`, ['--r' as string]: `${(i % 2 ? 1 : -1) * 220}deg` }} />
                        </g>
                      );
                    })}
                  </svg>
                )}
              </div>
            </div>

            <div className="shrink-0 text-center">
              <div key={s.points[t]} className={cn('q-display tabular-nums text-white duel-pop', big ? 'text-6xl' : 'text-3xl')}>
                {s.points[t]}
              </div>
              <div className={cn('font-bold text-white/55', big ? 'text-lg' : 'text-[10px]')}>نقطة</div>
            </div>

            {res && last === t && (
              <div key={key} className={cn('pointer-events-none absolute inset-0 grid place-items-center text-center font-black drop-shadow-[0_3px_0_#000]', big ? 'text-5xl' : 'text-2xl', res.gained ? 'text-q-green' : 'text-q-red')}>
                <span className="duel-float-up inline-block">{res.gained ? `+${res.gained}` : res.broke ? '💥 انكسرت السلسلة!' : '✕ ما ضبطت'}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
