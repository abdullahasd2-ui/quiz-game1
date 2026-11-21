// «القلعة»: two living castles facing each other. Everything that moves is tied to the game:
// - the lobby builds each castle as its chat joins (gate, keep, towers, flags), and the gate opens for every newcomer;
// - each result fires one fireball per team that hit, at the other castle, with its damage;
// - a castle's life shows on its body: cracks, then fallen tower tops, fire and smoke, then the collapse;
// - the damage a team dealt lights its torches of glory, and the sky reddens as the battle gets closer to an end.
import { teamSize, type DuelState, type DuelTeam } from '@quiz/shared';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { HEX, sparks, Sky, teamLabel } from './common';
import { Castle3D, use3D } from './Castle3D';

/** 0 intact · 1 cracked · 2 a tower top falls, fire · 3 both tops, smoke · 4 fallen. */
export function damageLevel(hp: number, max: number) {
  if (hp <= 0) return 4;
  const r = hp / max;
  return r > 0.75 ? 0 : r > 0.5 ? 1 : r > 0.25 ? 2 : 3;
}

/** How much of the castle stands in the lobby, from the number of players (once the game starts: all of it). */
export function buildLevel(players: number, playing: boolean) {
  if (playing) return 4;
  return players >= 6 ? 4 : players >= 3 ? 3 : players >= 1 ? 2 : 1;
}

type CastleProps = {
  team: DuelTeam;
  level: number;
  built: number;
  gateOpen: boolean;
  /** Torches lit along the wall (0–5). */
  torches: number;
  alert: boolean;
  /** Fully lit, gate wide open: the winner. */
  glory?: boolean;
  className?: string;
};

/** The castle drawing (SVG). Parts appear with `built`, break with `level`. */
export function Castle({ team, level, built, gateOpen, torches, alert, glory = false, className }: CastleProps) {
  const c = HEX[team];
  const id = `c-${team}${glory ? 'g' : ''}`;
  const win = glory ? '#ffe9a8' : c.light;
  return (
    <svg viewBox="0 0 220 170" className={cn('castle h-full w-full overflow-visible', className)} aria-hidden>
      <defs>
        <linearGradient id={`${id}-stone`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#5b5c7a" />
          <stop offset="1" stopColor="#2c2c45" />
        </linearGradient>
        <linearGradient id={`${id}-side`} x1="0" x2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.35" />
          <stop offset="0.5" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.08" />
        </linearGradient>
        <linearGradient id={`${id}-roof`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={c.light} />
          <stop offset="1" stopColor={c.dark} />
        </linearGradient>
        <radialGradient id={`${id}-glow`}>
          <stop offset="0" stopColor={glory ? '#ffd76a' : c.light} stopOpacity="0.85" />
          <stop offset="1" stopColor={c.light} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Light around the castle: team colour, gold for the winner, brighter while a question runs. */}
      <ellipse cx="110" cy="110" rx={glory ? 120 : 95} ry={glory ? 80 : 60} fill={`url(#${id}-glow)`} opacity={glory ? 0.9 : alert ? 0.45 : 0.25} style={{ transition: 'opacity 0.8s' }} />

      {/* Hill */}
      <path d="M0 170 C 40 140 70 138 110 138 C 150 138 180 140 220 170 Z" fill="#17132f" />
      <path d="M0 170 C 40 146 70 144 110 144 C 150 144 180 146 220 170 Z" fill="#221b42" />

      {/* Back towers (built at 3) */}
      {[
        { x: 22, top: 'a' },
        { x: 168, top: 'b' },
      ].map(({ x, top }, i) => (
        <g key={top} className="castle-part" data-built={built >= 3} style={{ transitionDelay: `${i * 0.15}s` }}>
          <rect x={x} y="58" width="30" height="86" fill={`url(#${id}-stone)`} />
          <rect x={x} y="58" width="30" height="86" fill={`url(#${id}-side)`} />
          <rect x={x + 10} y="66" width="9" height="13" rx="4.5" className="castle-window" data-alert={alert} fill={win} style={{ ['--delay' as string]: `${i * 0.7}s` }} />
          {/* The top: falls at level 2 (first) and 3 (second). */}
          <g className="castle-fall" data-fallen={level >= (i === 0 ? 2 : 3)} style={{ ['--fx' as string]: i === 0 ? '-10px' : '10px', ['--fr' as string]: i === 0 ? '-40deg' : '40deg' }}>
            <path d={`M${x - 3} 58 h36 v-8 h-6 v5 h-6 v-5 h-6 v5 h-6 v-5 h-6 v5 h-6 v-5 h-6 Z`} fill="#4a4b68" />
            <path d={`M${x - 4} 50 L${x + 15} 18 L${x + 34} 50 Z`} fill={`url(#${id}-roof)`} />
            <line x1={x + 15} y1="18" x2={x + 15} y2="4" stroke="#ccc" strokeWidth="1.5" />
            <path className="castle-flag" d={`M${x + 15} 4 h16 l-4 5 l4 5 h-16 Z`} fill={glory ? '#f7c948' : c.light} opacity={built >= 4 ? 1 : 0} style={{ transition: 'opacity .6s' }} />
          </g>
        </g>
      ))}

      {/* Front wall with battlements (always: the foundation) */}
      <g className="castle-part rise" data-built={built >= 1}>
        <rect x="40" y="92" width="140" height="52" fill={`url(#${id}-stone)`} />
        <path d="M38 92 h144 v-9 h-8 v6 h-8 v-6 h-8 v6 h-8 v-6 h-8 v6 h-8 v-6 h-8 v6 h-8 v-6 h-8 v6 h-8 v-6 h-8 v6 h-8 v-6 h-8 v6 h-8 v-6 h-8 v6 h-8 v-6 h-8 v6 h-8 v-6 h-8 v6 h-8 Z" fill="#4a4b68" />
        {/* stones */}
        {[100, 112, 124, 136].map((y, r) => (
          <line key={y} x1="40" y1={y} x2="180" y2={y} stroke="#000" strokeOpacity="0.18" strokeDasharray={r % 2 ? '14 2' : '9 2 14 2'} />
        ))}
      </g>

      {/* Torches of glory along the wall: lit by the damage this team dealt. */}
      {[52, 72, 148, 168, 110].map((x, i) => (
        <g key={x} className="castle-torch" data-lit={i < torches} transform={`translate(${x} ${i === 4 ? 70 : 86})`} style={{ transitionDelay: `${i * 0.12}s` }}>
          <rect x="-1.5" y="0" width="3" height="7" fill="#6b4b2a" />
          <path d="M0 -9 C 4 -4 4 0 0 1 C -4 0 -4 -4 0 -9 Z" fill="#ffb347" />
          <circle cx="0" cy="-3" r="7" fill="#ff9f43" opacity="0.25" />
        </g>
      ))}

      {/* Keep (built at 2) */}
      <g className="castle-part" data-built={built >= 2}>
        <rect x="80" y="44" width="60" height="100" fill={`url(#${id}-stone)`} />
        <rect x="80" y="44" width="60" height="100" fill={`url(#${id}-side)`} />
        <path d="M76 44 h68 v-9 h-7 v6 h-7 v-6 h-7 v6 h-7 v-6 h-7 v6 h-7 v-6 h-7 v6 h-7 v-6 h-7 v6 h-5 Z" fill="#4a4b68" />
        <path d="M84 35 L110 6 L136 35 Z" fill={`url(#${id}-roof)`} />
        <line x1="110" y1="6" x2="110" y2="-10" stroke="#ddd" strokeWidth="1.6" />
        <path className="castle-flag" d="M110 -10 h22 l-5 6 l5 6 h-22 Z" fill={glory ? '#f7c948' : c.light} />
        {[94, 120].map((x, i) => (
          <rect key={x} x={x} y="58" width="7" height="12" rx="3.5" className="castle-window" data-alert={alert} fill={win} style={{ ['--delay' as string]: `${0.4 + i * 0.5}s` }} />
        ))}
        <circle cx="110" cy="80" r="7" fill={win} className="castle-window" data-alert={alert} />
        <path d="M110 74 l2 4 h4 l-3 3 l1 4 l-4 -2 l-4 2 l1 -4 l-3 -3 h4 Z" fill={c.dark} opacity="0.7" />
      </g>

      {/* Gate: light spills when it opens */}
      <g className="castle-part" data-built={built >= 2}>
        <path d="M94 144 v-26 a16 16 0 0 1 32 0 v26 Z" fill="#0c0a1c" />
        <radialGradient id={`${id}-door`} cx="0.5" cy="1" r="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="0.35" stopColor={glory ? '#ffd76a' : c.light} stopOpacity="0.8" />
          <stop offset="1" stopColor={glory ? '#ffb347' : c.dark} stopOpacity="0.15" />
        </radialGradient>
        <radialGradient id={`${id}-spill`}>
          <stop offset="0" stopColor={glory ? '#ffd76a' : c.light} stopOpacity="0.7" />
          <stop offset="1" stopColor={glory ? '#ffd76a' : c.light} stopOpacity="0" />
        </radialGradient>
        <path className="castle-gatelight" data-open={gateOpen || glory} d="M94 144 v-26 a16 16 0 0 1 32 0 v26 Z" fill={`url(#${id}-door)`} />
        <ellipse className="castle-gatelight" data-open={gateOpen || glory} cx="110" cy="148" rx="46" ry="9" fill={`url(#${id}-spill)`} />
        <svg x="94" y="102" width="32" height="42" overflow="hidden">
          <g className="castle-gate" data-open={gateOpen || glory}>
            <rect x="0" y="0" width="32" height="42" fill="#3a2a1a" />
            {[4, 11, 18, 25].map((x) => (
              <rect key={x} x={x} y="0" width="2.5" height="42" fill="#8a7a5a" />
            ))}
            {[10, 22, 34].map((y) => (
              <rect key={y} x="0" y={y} width="32" height="2" fill="#8a7a5a" />
            ))}
          </g>
        </svg>
        <path d="M92 144 v-26 a18 18 0 0 1 36 0 v26" fill="none" stroke="#6a6b8a" strokeWidth="3" />
      </g>

      {/* Cracks (level 1+) */}
      <g stroke="#0a0818" strokeWidth="1.6" fill="none" strokeLinecap="round">
        <path className="castle-crack" data-on={level >= 1} d="M60 96 l6 10 l-4 8 l7 12" />
        <path className="castle-crack" data-on={level >= 1} d="M132 50 l-5 12 l6 9 l-3 14" />
        <path className="castle-crack" data-on={level >= 2} d="M160 98 l-7 9 l5 9 l-6 10" />
        <path className="castle-crack" data-on={level >= 3} d="M92 60 l7 11 l-6 9 l5 12 l-5 10" />
      </g>

      {/* Fire (level 2+) and smoke (level 3+) */}
      {level >= 2 && level < 4 && (
        <g>
          <path className="castle-fire" d="M40 60 C 46 48 44 40 37 32 C 52 38 55 52 50 62 Z" fill="#ff7a2f" />
          <path className="castle-fire" d="M41 61 C 44 53 43 47 40 42 C 48 47 49 54 47 61 Z" fill="#ffd166" />
        </g>
      )}
      {level >= 3 && level < 4 && (
        <g fill="#2a2638">
          {[0, 1, 2].map((i) => (
            <circle key={i} className="castle-smoke" cx={i === 1 ? 182 : 40} cy="46" r="9" style={{ ['--delay' as string]: `${i * 1}s` }} />
          ))}
          <path className="castle-fire" d="M176 62 C 182 50 180 42 173 34 C 188 40 191 54 186 64 Z" fill="#ff7a2f" />
        </g>
      )}
    </svg>
  );
}

/** Both castles on the battlefield, with the fireballs of the last result. */
export function CastleWorld({ s, big }: { s: DuelState; big: boolean }) {
  const playing = s.phase !== 'lobby';
  const max = s.settings.castleHp;
  const res = s.phase === 'result' || s.phase === 'over' ? s.round?.result : undefined;
  const resultKey = `${s.session}:${s.rounds}`;
  // Heat: how close the closer castle is to falling.
  const heat = playing ? 1 - Math.min(s.hp.a, s.hp.b) / max : 0;
  const dusk = Math.min(1, s.rounds / 12);

  // The gate opens for a moment each time someone joins.
  const sizes = { a: teamSize(s, 'a'), b: teamSize(s, 'b') };
  const prev = useRef(sizes);
  const [gate, setGate] = useState<Record<DuelTeam, number>>({ a: Date.now() + 1600, b: Date.now() + 1600 });
  useEffect(() => {
    const now = Date.now();
    (['a', 'b'] as const).forEach((t) => {
      if (sizes[t] > prev.current[t]) setGate((g) => ({ ...g, [t]: now + 1300 }));
    });
    prev.current = sizes;
  }, [sizes.a, sizes.b]); // eslint-disable-line react-hooks/exhaustive-deps
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 400);
    return () => clearInterval(id);
  }, []);

  const torches = (t: DuelTeam) => Math.min(5, Math.floor(((max - s.hp[t === 'a' ? 'b' : 'a']) / max) * 5.01));
  const three = use3D();
  const h = big ? (three ? 'h-[min(52vh,520px)]' : 'h-[min(46vh,440px)]') : 'h-56 sm:h-64';
  const now = Date.now();
  if (three) {
    // The 3D battlefield; life bars and damage numbers stay as sharp HTML on top of it.
    return (
      <div className={cn('duel-stage border border-white/10 bg-[#0b0a26]', h)}>
        <Castle3D
          big={big}
          input={{
            hp: s.hp,
            max,
            built: { a: buildLevel(sizes.a, playing), b: buildLevel(sizes.b, playing) },
            torches: { a: torches('a'), b: torches('b') },
            gateOpen: { a: now < gate.a, b: now < gate.b },
            alert: s.phase === 'question',
            heat,
            hitKey: res ? resultKey : null,
            dealt: { a: res?.damage?.a ?? 0, b: res?.damage?.b ?? 0 },
            winner: null,
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,transparent_55%,rgba(5,4,18,0.35))]" />
        {(['a', 'b'] as const).map((t) => {
          const taken = res?.damage?.[t === 'a' ? 'b' : 'a'] ?? 0;
          return (
            <div key={t} className={cn('pointer-events-none absolute bottom-[3%] h-full w-[44%]', t === 'a' ? 'right-[3%]' : 'left-[3%]')}>
              {taken > 0 && (
                <div key={resultKey} className={cn('absolute inset-x-0 top-[12%] text-center font-black text-q-red drop-shadow-[0_3px_0_#000]', big ? 'text-6xl' : 'text-3xl')}>
                  <span className="duel-float-up inline-block" dir="ltr" style={{ ['--delay' as string]: '0.9s' }}>
                    💥 −{taken}
                  </span>
                </div>
              )}
              <LifeBar t={t} hp={s.hp[t]} max={max} big={big} label={teamLabel(s, t)} />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn('duel-stage border border-white/10', h)} style={{ ['--heat' as string]: heat, ['--dusk' as string]: dusk }}>
      <Sky />
      {(['a', 'b'] as const).map((t) => {
        const lvl = damageLevel(s.hp[t], max);
        const taken = res?.damage?.[t === 'a' ? 'b' : 'a'] ?? 0;
        const fallen = s.hp[t] <= 0;
        return (
          <div
            key={t}
            className={cn('absolute bottom-[4%] w-[44%]', t === 'a' ? 'right-[2%]' : 'left-[2%]', big ? 'h-[82%]' : 'h-[80%]')}
          >
            <HitShake on={taken > 0} hitKey={resultKey}>
            <div className={cn('h-full', fallen && s.phase === 'over' && 'castle-down')} style={{ transform: t === 'b' ? 'scaleX(-1)' : undefined }}>
              <Castle team={t} level={lvl} built={buildLevel(sizes[t], playing)} gateOpen={Date.now() < gate[t]} torches={torches(t)} alert={s.phase === 'question'} />
            </div>
            </HitShake>
            {taken > 0 && (
              <div key={resultKey} className={cn('absolute inset-x-0 top-[6%] text-center font-black text-q-red drop-shadow-[0_3px_0_#000]', big ? 'text-6xl' : 'text-3xl')}>
                <span className="duel-float-up inline-block" dir="ltr" style={{ ['--delay' as string]: '0.95s' }}>
                  💥 −{taken}
                </span>
              </div>
            )}
            <LifeBar t={t} hp={s.hp[t]} max={max} big={big} label={teamLabel(s, t)} />
          </div>
        );
      })}

      {/* Fireballs: from each team that hit, toward the other castle. */}
      {res?.damage &&
        (['a', 'b'] as const).map((t, i) =>
          (res.damage![t] ?? 0) > 0 ? (
            <div key={`${resultKey}-${t}`}>
              {/* The outer box is as wide as the stage, so the flight is a share of its width on any screen. */}
              <div className="duel-shot inset-x-0" style={{ ['--dx' as string]: t === 'a' ? '-56%' : '56%', ['--delay' as string]: `${i * 0.12}s` }}>
                <span className="absolute" style={{ [t === 'a' ? 'right' : 'left']: '20%', ['--arc' as string]: big ? '-160px' : '-80px', ['--delay' as string]: `${i * 0.12}s` }}>
                  <b className={cn('block', big ? 'text-6xl' : 'text-3xl')} style={{ filter: `drop-shadow(0 0 12px ${HEX[t].light})` }}>
                    ☄️
                  </b>
                </span>
              </div>
              <Burst at={t === 'a' ? '22%' : '78%'} color={HEX[t].light} big={big} />
              <div className="duel-flash" style={{ ['--fx' as string]: t === 'a' ? '22%' : '78%' }} />
            </div>
          ) : null,
        )}
    </div>
  );
}

/** Shakes and flashes its castle when the fireball lands (without re-mounting it, so nothing else replays). */
function HitShake({ on, hitKey, children }: { on: boolean; hitKey: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!on || !ref.current?.animate) return;
    ref.current.animate(
      [
        { transform: 'none', filter: 'none' },
        { transform: 'translateX(-7px) rotate(-1.2deg)', filter: 'brightness(2.2) saturate(0.4)', offset: 0.1 },
        { transform: 'translateX(6px) rotate(1deg)', offset: 0.25 },
        { transform: 'translateX(-4px)', offset: 0.45 },
        { transform: 'translateX(2px)', offset: 0.65 },
        { transform: 'none', filter: 'none' },
      ],
      { duration: 700, delay: 950, easing: 'ease-out' },
    );
  }, [on, hitKey]);
  return (
    <div ref={ref} className="h-full">
      {children}
    </div>
  );
}

function Burst({ at, color, big }: { at: string; color: string; big: boolean }) {
  return (
    <div className="duel-burst" style={{ left: at, top: '48%' }}>
      {sparks(14, big ? 120 : 60).map((p, i) => (
        <i key={i} style={{ ['--x' as string]: `${p.x}px`, ['--y' as string]: `${p.y}px`, ['--c' as string]: i % 3 ? '#ffb347' : color }} />
      ))}
    </div>
  );
}

function LifeBar({ t, hp, max, big, label }: { t: DuelTeam; hp: number; max: number; big: boolean; label: string }) {
  const pct = Math.max(0, Math.min(100, (hp / max) * 100));
  const low = pct <= 25;
  return (
    <div className={cn('absolute inset-x-[10%] rounded-2xl border border-white/15 bg-black/60 px-2 py-1 backdrop-blur', big ? '-bottom-1' : '-bottom-0.5')}>
      <div className={cn('mb-0.5 flex items-center justify-between gap-2 font-black', big ? 'text-xl' : 'text-[11px]')}>
        <span className="truncate" style={{ color: HEX[t].light }} dir="ltr">
          🏰 {label}
        </span>
        <span className={cn('tabular-nums', low ? 'text-q-red' : 'text-white')}>
          ❤️ {hp}
          <span className="text-white/40">/{max}</span>
        </span>
      </div>
      <div className={cn('relative overflow-hidden rounded-full bg-white/10', big ? 'h-4' : 'h-2')}>
        <div
          className={cn('h-full rounded-full transition-[width] duration-1000 ease-out', low && 'animate-pulse')}
          style={{ width: `${pct}%`, background: low ? 'linear-gradient(90deg,#ff4d4d,#ff9f43)' : `linear-gradient(90deg, ${HEX[t].dark}, ${HEX[t].light})`, transitionDelay: '1s' }}
        />
      </div>
    </div>
  );
}
