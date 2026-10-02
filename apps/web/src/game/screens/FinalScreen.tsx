import type { RoomView } from '@quiz/shared';
import { cn } from '@/lib/utils';
import { TEAM_TEXT, teamName } from '../ui';

export function FinalScreen({ view, onPlayAgain }: { view: RoomView; onPlayAgain: () => void }) {
  const [s0, s1] = [view.teams[0]?.score ?? 0, view.teams[1]?.score ?? 0];
  const winner = s0 === s1 ? null : s0 > s1 ? 0 : 1;
  return (
    <div className="animate-fade-up px-4 py-9 text-center">
      <div className="mb-3 animate-trophy text-7xl">{winner === null ? '🤝' : '🏆'}</div>
      <div className="mb-1 text-[26px] font-black text-q-gold">{winner === null ? 'تعادل!' : `${teamName(view, winner)} الفائز!`}</div>
      <div className="mb-6 text-[13px] text-white/50">{winner === null ? 'نفس النقاط بالضبط' : `بفارق ${Math.abs(s0 - s1)} نقطة`}</div>
      <div className="mb-6 grid grid-cols-2 gap-3">
        {([0, 1] as const).map((t) => (
          <div key={t} className={cn('rounded-2xl bg-q-panel p-4', winner === t && 'ring-2 ring-q-gold')}>
            <div className="mb-1 truncate text-xs text-white/50">{teamName(view, t)}</div>
            <div className={cn('text-[38px] font-black tabular-nums', TEAM_TEXT[t])}>{t === 0 ? s0 : s1}</div>
          </div>
        ))}
      </div>
      <button type="button" className="q-btn-gold" onClick={onPlayAgain}>
        🔄 العب مرة ثانية
      </button>
    </div>
  );
}
