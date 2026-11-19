// The end of the challenge: a cinematic scene, not just a word. The camera flies in on the winner,
// light rays turn behind it, fireworks go off, the heroes rise on a podium and the final score is laid out.
// In «القلعة» the winner's castle opens its gate wide and lights up gold while the loser's falls.
import { CHAIN_MAX, duelTop, type DuelState, type DuelTeam } from '@quiz/shared';
import { useMemo } from 'react';
import { Confetti } from '@/game/fx/Confetti';
import { cn } from '@/lib/utils';
import { Castle } from './CastleWorld';
import { HEX, sparks, teamLabel } from './common';

const MEDALS = ['🥇', '🥈', '🥉'];

function Fireworks({ count, colors }: { count: number; colors: string[] }) {
  const list = useMemo(
    () => Array.from({ length: count }, (_, i) => ({ left: `${10 + ((i * 37) % 80)}%`, top: `${8 + ((i * 23) % 40)}%`, delay: `${(i * 0.45) % 2.6}s`, c: colors[i % colors.length]! })),
    [count, colors],
  );
  return (
    <>
      {list.map((f, i) => (
        <div key={i} className="duel-firework" style={{ left: f.left, top: f.top }}>
          {sparks(12, 70).map((p, j) => (
            <i key={j} style={{ ['--x' as string]: `${p.x}px`, ['--y' as string]: `${p.y}px`, ['--c' as string]: j % 3 ? f.c : '#fff6d5', ['--delay' as string]: f.delay }} />
          ))}
        </div>
      ))}
    </>
  );
}

/** One line of the final score, per mode. */
function scoreOf(s: DuelState, t: DuelTeam) {
  if (s.settings.mode === 'castle') return { big: `❤️ ${s.hp[t]}`, small: `من ${s.settings.castleHp} حياة` };
  if (s.settings.mode === 'faza') return { big: `⚡ ${s.wins[t]}`, small: `من ${s.settings.fazaWins} جولات` };
  return { big: `${s.points[t]}`, small: s.chain[t] ? `نقطة · سلسلتهم في النهاية ${Math.min(CHAIN_MAX, s.chain[t])} حلقات` : 'نقطة' };
}

export function Victory({ s, big }: { s: DuelState; big: boolean }) {
  const w = s.winner === 'draw' ? null : (s.winner as DuelTeam | null);
  const color = w ? HEX[w].light : '#f7c948';
  const mode = s.settings.mode;
  const headline = !w ? 'تعادل الشاتين!' : mode === 'castle' ? (s.hp[w === 'a' ? 'b' : 'a'] <= 0 ? 'سقطت قلعة الخصم!' : 'انتهى الحصار!') : mode === 'faza' ? 'فزعة الانتصار!' : 'السلسلة الذهبية!';
  return (
    <div className={cn('duel-victory duel-stage relative border-2 bg-[#07061a] text-center', big ? 'p-8' : 'p-4')} style={{ borderColor: `${color}88`, boxShadow: `0 0 80px -20px ${color}` }}>
      <div className="duel-rays" style={{ ['--ray' as string]: `${color}2a` }} />
      <Fireworks count={big ? 7 : 4} colors={[color, '#f7c948', '#ff9f43', '#fff']} />
      {w && <Confetti big={big} />}

      <div className="duel-camera relative">
        <div className={cn('font-black tracking-widest text-white/60', big ? 'text-2xl' : 'text-xs')}>{headline}</div>
        <div className={cn('q-display duel-title-shine leading-tight', big ? 'text-8xl' : 'text-4xl')}>
          {w ? (
            <>
              النصر لشات <span dir="ltr">{teamLabel(s, w)}</span>
            </>
          ) : (
            'تعادل!'
          )}
        </div>

        {mode === 'castle' && (
          <div className={cn('relative mx-auto mt-2 grid grid-cols-[1fr_1.6fr_1fr] items-end', big ? 'h-80 max-w-5xl' : 'h-40')}>
            {/* Loser (small, falling) · winner (big, gate wide open, gold) · loser */}
            {w ? (
              <>
                {/* The winner's side (blue on the right, red on the left) holds the loser's ruin on the other side. */}
                <div className={cn('h-1/2 self-end opacity-60', w === 'a' ? 'order-3' : 'order-1')} style={{ transform: w === 'b' ? 'scaleX(-1)' : undefined }}>
                  <Castle team={w === 'a' ? 'b' : 'a'} level={s.hp[w === 'a' ? 'b' : 'a'] <= 0 ? 4 : 3} built={4} gateOpen={false} torches={0} alert={false} />
                </div>
                <div className="order-2 h-full">
                  <Castle team={w} level={0} built={4} gateOpen torches={5} alert glory />
                </div>
                <div className={w === 'a' ? 'order-1' : 'order-3'} />
              </>
            ) : (
              <>
                <div className="h-4/5" style={{ transform: 'scaleX(-1)' }}>
                  <Castle team="b" level={2} built={4} gateOpen={false} torches={3} alert={false} />
                </div>
                <div />
                <div className="h-4/5">
                  <Castle team="a" level={2} built={4} gateOpen={false} torches={3} alert={false} />
                </div>
              </>
            )}
          </div>
        )}
        {mode === 'chain' && w && (
          <div className={cn('mx-auto my-3 flex justify-center gap-1', big ? 'text-6xl' : 'text-3xl')}>
            {Array.from({ length: CHAIN_MAX }, (_, i) => (
              <span key={i} className="duel-pop" style={{ ['--delay' as string]: `${0.6 + i * 0.12}s`, filter: 'drop-shadow(0 0 10px #f7c948)' }}>
                ⛓️
              </span>
            ))}
          </div>
        )}
        {mode === 'faza' && w && (
          <div className={cn('mx-auto my-3 flex justify-center', big ? 'text-8xl' : 'text-5xl')}>
            <span className="faza-orb inline-block rounded-full" style={{ filter: `drop-shadow(0 0 24px ${color})` }}>
              ⚡
            </span>
          </div>
        )}

        {/* Final score */}
        <div className={cn('mx-auto mt-3 grid grid-cols-2 gap-3', big ? 'max-w-4xl' : '')}>
          {(['a', 'b'] as const).map((t, i) => {
            const sc = scoreOf(s, t);
            return (
              <div key={t} className={cn('duel-pop rounded-2xl border bg-black/40 p-3 backdrop-blur', w === t && 'ring-2 ring-q-gold')} style={{ borderColor: `${HEX[t].light}66`, ['--delay' as string]: `${1 + i * 0.15}s` }}>
                <div className={cn('truncate font-black', big ? 'text-2xl' : 'text-xs')} style={{ color: HEX[t].light }} dir="ltr">
                  {w === t ? '👑 ' : ''}
                  {teamLabel(s, t)}
                </div>
                <div className={cn('q-display tabular-nums text-white', big ? 'text-5xl' : 'text-2xl')}>{sc.big}</div>
                <div className={cn('text-white/55', big ? 'text-lg' : 'text-[10px]')}>{sc.small}</div>
              </div>
            );
          })}
        </div>

        {/* Heroes of each chat on a podium */}
        <div className={cn('mx-auto mt-4 grid grid-cols-2 gap-3', big ? 'max-w-4xl' : '')}>
          {(['a', 'b'] as const).map((t) => {
            const top = duelTop(s, t);
            const order = [top[1], top[0], top[2]];
            const heights = big ? ['h-20', 'h-28', 'h-14'] : ['h-10', 'h-14', 'h-7'];
            return (
              <div key={t}>
                <div className={cn('mb-1 font-black text-white/70', big ? 'text-xl' : 'text-[11px]')}>
                  أبطال <span dir="ltr">{teamLabel(s, t)}</span>
                </div>
                {top.length === 0 ? (
                  <div className="text-xs text-white/40">ما أحد جاوب صح</div>
                ) : (
                  <div className="flex items-end justify-center gap-1.5">
                    {order.map((p, i) =>
                      p ? (
                        <div key={p.name} className="flex w-1/3 flex-col items-center">
                          <div className={cn('truncate font-black', big ? 'text-xl' : 'text-[11px]')}>
                            {MEDALS[i === 1 ? 0 : i === 0 ? 1 : 2]} {p.name}
                          </div>
                          <div
                            className={cn('duel-podium grid w-full place-items-center rounded-t-xl font-black tabular-nums text-black', heights[i], big ? 'text-xl' : 'text-[10px]')}
                            style={{ background: `linear-gradient(to bottom, ${i === 1 ? '#f7c948' : HEX[t].light}, ${HEX[t].dark})`, ['--delay' as string]: `${1.4 + i * 0.2}s` }}
                          >
                            {p.score}
                          </div>
                        </div>
                      ) : (
                        <div key={i} className="w-1/3" />
                      ),
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
