import { DUEL_MODES, DUEL_TEAMS, teamSize, type DuelState, type DuelTeam, type QuestionType } from '@quiz/shared';
import { QuestionImage } from '@/game/ui';
import { cn } from '@/lib/utils';
import { CastleWorld } from './duel/CastleWorld';
import { ChainWorld } from './duel/ChainWorld';
import { FazaWorld } from './duel/FazaWorld';
import { useDuelSounds } from './duel/useDuelSounds';
import { Victory } from './duel/Victory';
import './duel/duel.css';

/** Each mode's frame for the question card: stone and gold for the castle, steel for the chain, electric for the faza. */
const FRAME = {
  castle: 'border-amber-300/35 bg-linear-to-b from-[#1d1830]/95 to-[#120f22]/95 shadow-[inset_0_1px_0_rgba(255,220,150,0.15),0_20px_50px_-20px_rgba(0,0,0,0.9)]',
  chain: 'border-slate-300/25 bg-linear-to-b from-[#161a2e]/95 to-[#0d1020]/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]',
  faza: 'border-yellow-300/35 bg-linear-to-b from-[#1a1530]/95 to-[#0d0b1f]/95 shadow-[0_0_40px_-18px_rgba(250,204,21,0.7)]',
} as const;

/** Each team's colours: the host's channel is blue, the guest's is red. */
export const TEAM = {
  a: { name: 'الأزرق', text: 'text-sky-300', ring: 'border-sky-400/70', bg: 'from-sky-600/35 to-sky-950/60', bar: 'from-sky-400 to-cyan-300', glow: 'shadow-[0_0_50px_-10px_rgba(56,189,248,0.8)]', chip: 'bg-sky-500/20 text-sky-200' },
  b: { name: 'الأحمر', text: 'text-rose-300', ring: 'border-rose-400/70', bg: 'from-rose-600/35 to-rose-950/60', bar: 'from-rose-400 to-orange-300', glow: 'shadow-[0_0_50px_-10px_rgba(251,113,133,0.8)]', chip: 'bg-rose-500/20 text-rose-200' },
} as const;

export const modeOf = (s: DuelState) => DUEL_MODES.find((m) => m.id === s.settings.mode)!;
const sec = (ms: number) => Math.max(0, Math.ceil(ms / 1000));

/** The whole game as the broadcast shows it. `now` is the host's clock. */
export function DuelArena({ s, now, big = false, sound = false }: { s: DuelState; now: number; big?: boolean; sound?: boolean }) {
  const mode = modeOf(s);
  const r = s.round;
  // Sounds play on the broadcast screen (what the viewers hear), not on the host's page.
  useDuelSounds(s, sound);
  if (s.phase === 'over') {
    return (
      <div className={cn('mx-auto w-full', big ? 'max-w-[1500px]' : 'max-w-4xl')}>
        <Victory s={s} big={big} />
      </div>
    );
  }
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

      {s.settings.mode === 'castle' && <CastleWorld s={s} big={big} />}
      {s.settings.mode === 'faza' && <FazaWorld s={s} big={big} />}
      {s.settings.mode === 'chain' && <ChainWorld s={s} big={big} />}

      {s.phase === 'lobby' && <JoinHint s={s} big={big} />}
      {(s.phase === 'question' || s.phase === 'result') && r && <QuestionCard s={s} now={now} big={big} />}
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
    <div key={`${s.session}:${s.rounds}:${s.phase === 'result'}`} className={cn('rounded-3xl border-2 p-4 backdrop-blur motion-safe:animate-fx-zoom', FRAME[s.settings.mode], big && 'p-6')}>
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
            <span className={big ? 'truncate' : 'min-w-0 leading-snug'}>{o}</span>
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
