import { CHAIN_MAX, DUEL_MODES, DUEL_TEAMS, duelTop, teamSize, type DuelState, type DuelTeam, type QuestionType } from '@quiz/shared';
import { QuestionImage } from '@/game/ui';
import { cn } from '@/lib/utils';

/** Each team's colours: the host's channel is blue, the guest's is red. */
export const TEAM = {
  a: { name: 'الأزرق', text: 'text-sky-300', ring: 'border-sky-400/70', bg: 'from-sky-600/35 to-sky-950/60', bar: 'from-sky-400 to-cyan-300', glow: 'shadow-[0_0_50px_-10px_rgba(56,189,248,0.8)]', chip: 'bg-sky-500/20 text-sky-200' },
  b: { name: 'الأحمر', text: 'text-rose-300', ring: 'border-rose-400/70', bg: 'from-rose-600/35 to-rose-950/60', bar: 'from-rose-400 to-orange-300', glow: 'shadow-[0_0_50px_-10px_rgba(251,113,133,0.8)]', chip: 'bg-rose-500/20 text-rose-200' },
} as const;

export const modeOf = (s: DuelState) => DUEL_MODES.find((m) => m.id === s.settings.mode)!;
const sec = (ms: number) => Math.max(0, Math.ceil(ms / 1000));

/** The whole game as the broadcast shows it. `now` is the host's clock. */
export function DuelArena({ s, now, big = false }: { s: DuelState; now: number; big?: boolean }) {
  const mode = modeOf(s);
  const r = s.round;
  return (
    <div className={cn('mx-auto flex w-full flex-col gap-4', big ? 'max-w-[1500px]' : 'max-w-4xl')}>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <TeamCard s={s} t="a" big={big} />
        <div className="text-center">
          <div className={cn('q-display bg-linear-to-b from-q-gold to-q-orange bg-clip-text text-transparent', big ? 'text-7xl' : 'text-4xl')}>VS</div>
          <div className={cn('mt-1 font-black text-white/70', big ? 'text-xl' : 'text-xs')}>
            {mode.emoji} {mode.title}
          </div>
        </div>
        <TeamCard s={s} t="b" big={big} />
      </div>

      {s.settings.mode === 'castle' && <Castles s={s} big={big} />}
      {s.settings.mode === 'faza' && <Race s={s} big={big} />}
      {s.settings.mode === 'chain' && <Chains s={s} big={big} />}

      {s.phase === 'lobby' && <JoinHint s={s} big={big} />}
      {(s.phase === 'question' || s.phase === 'result') && r && <QuestionCard s={s} now={now} big={big} />}
      {s.phase === 'over' && <Winner s={s} big={big} />}
    </div>
  );
}

function TeamCard({ s, t, big }: { s: DuelState; t: DuelTeam; big: boolean }) {
  const c = TEAM[t];
  const turn = s.settings.mode === 'chain' && s.phase === 'question' && s.round?.turn === t;
  const won = s.phase === 'over' && s.winner === t;
  return (
    <div className={cn('rounded-3xl border-2 bg-linear-to-b p-3 text-center transition-all', c.ring, c.bg, (turn || won) && c.glow, turn && 'scale-[1.03]')}>
      <div className={cn('truncate font-black', c.text, big ? 'text-3xl' : 'text-lg')} dir="ltr">
        {s.channels[t] || (t === 'a' ? 'قناتك' : 'الخصم')}
      </div>
      <div className={cn('font-bold text-white/70', big ? 'text-lg' : 'text-xs')}>👥 {teamSize(s, t)} لاعب{turn ? ' · 🎯 دوركم!' : ''}</div>
    </div>
  );
}

/** القلعة: both castles with their life. */
function Castles({ s, big }: { s: DuelState; big: boolean }) {
  const res = s.phase !== 'question' ? s.round?.result : undefined;
  return (
    <div className="grid grid-cols-2 gap-4">
      {DUEL_TEAMS.map((t) => {
        const hp = s.hp[t];
        const pct = Math.round((hp / s.settings.castleHp) * 100);
        const hit = res?.damage?.[t === 'a' ? 'b' : 'a'] ?? 0;
        return (
          <div key={t} className={cn('relative rounded-3xl border border-white/10 bg-q-panel/70 p-3 text-center', TEAM[t].text)}>
            <div className={cn('select-none transition-transform', big ? 'text-[110px] leading-none' : 'text-6xl', hp === 0 && 'rotate-12 opacity-40 grayscale', hit > 0 && 'motion-safe:animate-fx-shake')}>🏰</div>
            {hit > 0 && <div className={cn('absolute end-4 top-3 rounded-2xl bg-q-red/20 px-3 font-black text-q-red motion-safe:animate-pop-in', big ? 'text-5xl' : 'text-2xl')}>💥 −{hit}</div>}
            <div className={cn('mx-auto mt-2 overflow-hidden rounded-full bg-white/10', big ? 'h-7 w-4/5' : 'h-4 w-11/12')}>
              <div className={cn('h-full rounded-full bg-linear-to-l transition-[width] duration-700', TEAM[t].bar)} style={{ width: `${pct}%` }} />
            </div>
            <div className={cn('mt-1 font-black tabular-nums text-white', big ? 'text-3xl' : 'text-base')}>
              ❤️ {hp} <span className="text-white/40">/ {s.settings.castleHp}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** الفزعة: rounds won, and during a question the race toward the goal. */
function Race({ s, big }: { s: DuelState; big: boolean }) {
  const r = s.round;
  return (
    <div className="grid grid-cols-2 gap-4">
      {DUEL_TEAMS.map((t) => {
        const goal = r?.goal?.[t] ?? 1;
        const got = r?.live[t] ?? 0;
        const won = s.phase !== 'question' && r?.result?.winner === t;
        return (
          <div key={t} className={cn('rounded-3xl border border-white/10 bg-q-panel/70 p-3', won && TEAM[t].glow)}>
            <div className="mb-2 flex justify-center gap-1.5">
              {Array.from({ length: s.settings.fazaWins }, (_, i) => (
                <span key={i} className={cn('grid place-items-center rounded-full border-2', big ? 'size-10 text-xl' : 'size-6 text-xs', i < s.wins[t] ? cn('border-transparent bg-linear-to-b', TEAM[t].bar) : 'border-white/20')}>
                  {i < s.wins[t] ? '🏁' : ''}
                </span>
              ))}
            </div>
            {r && (
              <>
                <div className={cn('relative overflow-hidden rounded-full bg-white/10', big ? 'h-9' : 'h-5')}>
                  <div className={cn('h-full rounded-full bg-linear-to-l transition-[width] duration-300', TEAM[t].bar)} style={{ width: `${Math.min(100, (got / goal) * 100)}%` }} />
                  <span className={cn('absolute inset-y-0 end-2 grid place-items-center', big ? 'text-2xl' : 'text-sm')}>🏁</span>
                </div>
                <div className={cn('mt-1 text-center font-black tabular-nums', TEAM[t].text, big ? 'text-2xl' : 'text-sm')}>
                  {Math.min(got, goal)} / {goal} جواب صح
                </div>
              </>
            )}
            {won && <div className={cn('mt-1 text-center font-black text-q-gold motion-safe:animate-pop-in', big ? 'text-3xl' : 'text-base')}>🏆 أخذوا الجولة!</div>}
          </div>
        );
      })}
    </div>
  );
}

/** السلسلة: each team's chain (glowing links), multiplier and points. */
function Chains({ s, big }: { s: DuelState; big: boolean }) {
  const res = s.phase !== 'question' ? s.round?.result : undefined;
  const last = s.round?.turn;
  return (
    <div className="grid grid-cols-2 gap-4">
      {DUEL_TEAMS.map((t) => {
        const n = s.chain[t];
        const next = Math.min(CHAIN_MAX, n + 1);
        return (
          <div key={t} className="rounded-3xl border border-white/10 bg-q-panel/70 p-3 text-center">
            <div className={cn('q-display tabular-nums', TEAM[t].text, big ? 'text-6xl' : 'text-3xl')}>{s.points[t]}</div>
            <div className={cn('font-bold text-white/60', big ? 'text-lg' : 'text-xs')}>نقطة</div>
            <div className="my-2 flex min-h-8 flex-wrap justify-center gap-1">
              {n === 0 && <span className={cn('text-white/30', big ? 'text-xl' : 'text-xs')}>السلسلة فاضية</span>}
              {Array.from({ length: n }, (_, i) => (
                <span key={i} className={cn('rounded-full bg-linear-to-b motion-safe:animate-pop-in', TEAM[t].bar, TEAM[t].glow, big ? 'size-10' : 'size-6')} />
              ))}
            </div>
            <div className={cn('font-black', big ? 'text-2xl' : 'text-sm')}>
              🔥 الجواب الجاي <b className="text-q-gold">×{next}</b>
            </div>
            {res && last === t && (
              <div className={cn('mt-1 font-black motion-safe:animate-pop-in', big ? 'text-3xl' : 'text-base', res.gained ? 'text-q-green' : 'text-q-red')}>
                {res.gained ? `+${res.gained}` : res.broke ? '💥 انكسرت السلسلة!' : '✕ ما ضبطت'}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function JoinHint({ s, big }: { s: DuelState; big: boolean }) {
  return (
    <div className={cn('rounded-3xl border border-q-gold/30 bg-q-gold/5 p-4 text-center', big && 'p-6')}>
      <div className={cn('q-display text-q-gold', big ? 'text-5xl' : 'text-2xl')}>اكتب «دخول» في شات قناتك</div>
      <div className={cn('mt-2 font-bold text-white/80', big ? 'text-2xl' : 'text-sm')}>تنضم لفريق القناة اللي تتابعها، وتجاوب برقم الخيار أو تكتب الجواب.</div>
      <div className={cn('mt-1 text-white/60', big ? 'text-xl' : 'text-xs')}>{modeOf(s).short}</div>
    </div>
  );
}

function QuestionCard({ s, now, big }: { s: DuelState; now: number; big: boolean }) {
  const r = s.round!;
  const q = r.question;
  const res = s.phase === 'result' ? r.result : undefined;
  const left = sec(r.endsAt - now);
  const frac = Math.max(0, Math.min(1, (r.endsAt - now) / s.settings.answerMs));
  const asking = s.settings.mode === 'chain' ? r.turn : null;
  return (
    <div className="rounded-3xl border border-q-line bg-q-panel/80 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className={cn('rounded-full bg-white/10 px-3 py-1 font-black', big ? 'text-xl' : 'text-xs')}>
          {q.categoryName ?? 'سؤال'} · <b className="text-q-gold">{q.points}</b>
        </span>
        {asking && (
          <span className={cn('rounded-full px-3 py-1 font-black', TEAM[asking].chip, big ? 'text-xl' : 'text-xs')}>
            🎯 السؤال لشات <span dir="ltr">{s.channels[asking]}</span> بس
          </span>
        )}
        {!res && <span className={cn('font-black tabular-nums', left <= 5 ? 'text-q-red' : 'text-white', big ? 'text-4xl' : 'text-xl')}>⏱️ {left}</span>}
      </div>
      {!res && (
        <div className="mb-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-linear-to-l from-q-orange to-q-gold transition-[width] duration-500" style={{ width: `${frac * 100}%` }} />
        </div>
      )}
      {q.imageUrl && <QuestionImage url={q.imageUrl} type={(q.type ?? 'image') as QuestionType} revealed={Boolean(res)} large={big} />}
      <div className={cn('mb-3 text-center font-black leading-snug', big ? 'text-5xl' : 'text-xl')}>{q.text}</div>
      <div className="grid grid-cols-2 gap-2">
        {q.options.map((o, i) => (
          <div
            key={i}
            className={cn(
              'flex items-center gap-2 rounded-2xl border-2 px-3 py-2 font-black',
              big ? 'text-3xl' : 'text-base',
              res ? (i === q.correctIndex ? 'border-q-green bg-q-green/20' : 'border-white/10 opacity-50') : 'border-white/15 bg-white/5',
            )}
          >
            <span className={cn('grid shrink-0 place-items-center rounded-xl bg-linear-to-br from-q-orange to-q-gold text-black', big ? 'size-12' : 'size-7 text-sm')}>{i + 1}</span>
            <span className="truncate">{o}</span>
            {res && i === q.correctIndex && <span className="ms-auto">✅</span>}
          </div>
        ))}
      </div>
      {res && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {DUEL_TEAMS.filter((t) => s.settings.mode !== 'chain' || t === r.turn).map((t) => (
            <div key={t} className={cn('rounded-2xl border px-3 py-2 text-center', TEAM[t].ring, s.settings.mode === 'chain' && 'col-span-2')}>
              <div className={cn('font-black tabular-nums', TEAM[t].text, big ? 'text-4xl' : 'text-xl')}>{res.pct[t]}٪ صح</div>
              <div className={cn('text-white/70', big ? 'text-xl' : 'text-xs')}>
                {res.right[t]} من {s.settings.mode === 'chain' ? res.voters[t] : teamSize(s, t)}
                {res.star[t] && <> · ⭐ أسرع جواب: <b className="text-white">{res.star[t]}</b></>}
              </div>
            </div>
          ))}
        </div>
      )}
      {!res && <div className={cn('mt-3 text-center text-white/60', big ? 'text-xl' : 'text-xs')}>جاوب في شات قناتك: رقم الخيار (1–4) أو الجواب نفسه · أول جواب بس ينحسب</div>}
    </div>
  );
}

const MEDALS = ['🥇', '🥈', '🥉'];

function Winner({ s, big }: { s: DuelState; big: boolean }) {
  const w = s.winner;
  return (
    <div className="rounded-3xl border-2 border-q-gold/50 bg-q-gold/5 p-4 text-center">
      <div className={cn(big ? 'text-8xl' : 'text-5xl')}>🏆</div>
      <div className={cn('q-display', big ? 'text-6xl' : 'text-3xl', w === 'draw' ? 'text-white' : TEAM[w as DuelTeam].text)}>
        {w === 'draw' ? 'تعادل!' : <>فاز شات <span dir="ltr">{s.channels[w as DuelTeam]}</span>!</>}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {DUEL_TEAMS.map((t) => (
          <div key={t} className={cn('rounded-2xl border p-3', TEAM[t].ring)}>
            <div className={cn('mb-1 font-black', TEAM[t].text, big ? 'text-2xl' : 'text-sm')}>
              أبطال <span dir="ltr">{s.channels[t]}</span>
            </div>
            {duelTop(s, t).length === 0 && <div className="text-sm text-white/40">ما أحد جاوب صح</div>}
            {duelTop(s, t).map((p, i) => (
              <div key={p.name} className={cn('flex justify-between gap-2', big ? 'text-2xl' : 'text-sm')}>
                <span className="truncate">
                  {MEDALS[i]} {p.name}
                </span>
                <b className="tabular-nums text-q-gold">{p.score}</b>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
