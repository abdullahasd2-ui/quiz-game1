// Each team's stats board, shown beside the game on the broadcast: how many play, how many answered this question,
// the team's accuracy, right answers, fastest answers, its best question, the mode's own number and its top players.
import { CHAIN_MAX, duelTop, teamSize, type DuelState, type DuelTeam } from '@quiz/shared';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { HEX, teamLabel } from './common';

const MEDALS = ['🥇', '🥈', '🥉'];

function Stat({ icon, label, value, big, hot = false }: { icon: string; label: string; value: ReactNode; big: boolean; hot?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between gap-2 rounded-xl bg-white/5 px-2.5', big ? 'py-2' : 'py-1.5')}>
      <span className={cn('truncate font-bold text-white/70', big ? 'text-lg' : 'text-[11px]')}>
        {icon} {label}
      </span>
      <b key={String(value)} className={cn('q-display tabular-nums duel-pop', big ? 'text-2xl' : 'text-sm', hot ? 'text-q-gold' : 'text-white')} dir="ltr">
        {value}
      </b>
    </div>
  );
}

export function TeamBoard({ s, t, big }: { s: DuelState; t: DuelTeam; big: boolean }) {
  const st = s.stats?.[t] ?? { answered: 0, right: 0, stars: 0, best: 0, questions: 0 };
  const color = HEX[t].light;
  const r = s.round;
  const asking = s.phase === 'question' && r && (s.settings.mode !== 'chain' || r.turn === t);
  const answeredNow = r ? Object.keys(r.answers).filter((k) => k.startsWith(`${t}:`)).length : 0;
  const size = teamSize(s, t);
  const acc = st.answered ? Math.round((st.right / st.answered) * 100) : 0;
  const top = duelTop(s, t, 3);
  const mode =
    s.settings.mode === 'castle'
      ? { icon: '🏰', label: 'حياة القلعة', value: `${s.hp[t]}/${s.settings.castleHp}` }
      : s.settings.mode === 'faza'
        ? { icon: '⚡', label: 'جولات فازوا فيها', value: `${s.wins[t]}/${s.settings.fazaWins}` }
        : { icon: '⛓️', label: 'نقاط السلسلة', value: `${s.points[t]} · ×${Math.min(CHAIN_MAX, s.chain[t] + 1)}` };

  return (
    <aside
      className={cn('duel-stage flex flex-col gap-1.5 border-2 bg-linear-to-b from-[#120f2a]/95 to-[#0a0818]/95 backdrop-blur', big ? 'p-4' : 'p-2.5')}
      style={{ borderColor: `${color}55`, boxShadow: asking ? `0 0 40px -14px ${color}` : undefined }}
      aria-label={`لوحة ${teamLabel(s, t)}`}
    >
      <div className={cn('mb-1 truncate text-center font-black', big ? 'text-2xl' : 'text-sm')} style={{ color }} dir="ltr">
        📊 {teamLabel(s, t)}
      </div>
      <Stat icon="🧩" label={mode.label} value={mode.value} big={big} hot />
      <Stat icon="👥" label="اللاعبين" value={size} big={big} />
      {asking && <Stat icon="✍️" label="جاوبوا الحين" value={`${answeredNow}/${size}`} big={big} hot />}
      <Stat icon="🎯" label="دقة الفريق" value={`${acc}٪`} big={big} />
      <Stat icon="✅" label="أجوبة صح" value={st.right} big={big} />
      <Stat icon="⭐" label="مرات أسرع جواب" value={st.stars} big={big} />
      <Stat icon="📈" label="أفضل سؤال" value={`${st.best}٪`} big={big} />

      <div className={cn('mt-1 font-black text-white/60', big ? 'text-base' : 'text-[10px]')}>🏅 نجوم الفريق</div>
      {top.length === 0 ? (
        <div className={cn('text-white/40', big ? 'text-base' : 'text-[10px]')}>{size ? 'ما أحد جاوب صح للحين' : 'ننتظر أول لاعب'}</div>
      ) : (
        top.map((p, i) => (
          <div key={p.name} className={cn('flex items-center justify-between gap-2 rounded-lg px-2', big ? 'text-lg' : 'text-[11px]', i === 0 && 'bg-q-gold/10')}>
            <span className="truncate font-bold">
              {MEDALS[i]} {p.name}
            </span>
            <b className="tabular-nums text-q-gold">{p.score}</b>
          </div>
        ))
      )}
    </aside>
  );
}
