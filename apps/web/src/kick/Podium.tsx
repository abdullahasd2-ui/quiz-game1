import type { StreamRow } from '@quiz/shared';
import { cn } from '@/lib/utils';

const PLACES = [
  { medal: '🥇', label: 'الأول', height: 'h-36', tone: 'from-q-gold/35 to-q-gold/5 border-q-gold/60', text: 'text-q-gold' },
  { medal: '🥈', label: 'الثاني', height: 'h-24', tone: 'from-slate-300/25 to-slate-300/5 border-slate-300/40', text: 'text-slate-200' },
  { medal: '🥉', label: 'الثالث', height: 'h-16', tone: 'from-amber-700/35 to-amber-700/5 border-amber-600/50', text: 'text-amber-500' },
];

/** End of the game: the top three on a podium (2nd · 1st · 3rd). */
export function Podium({ rows, big = false }: { rows: StreamRow[]; big?: boolean }) {
  const top = rows.slice(0, 3);
  const order = [1, 0, 2].filter((i) => top[i]);
  return (
    <div className="text-center">
      <div className={cn('mb-1 animate-trophy', big ? 'text-6xl' : 'text-5xl')}>🏆</div>
      <div className={cn('mb-6 font-black text-q-gold', big ? 'text-4xl' : 'text-2xl')}>الفائز: {top[0]?.name}</div>
      <div dir="ltr" className="mx-auto flex max-w-lg items-end justify-center gap-3">
        {order.map((i) => {
          const r = top[i]!;
          const p = PLACES[i]!;
          return (
            <div key={r.key} className="flex w-1/3 flex-col items-center animate-fx-drop" style={{ animationDelay: `${(2 - i) * 0.25}s` }}>
              <div className={cn(big ? 'text-5xl' : 'text-4xl')}>{p.medal}</div>
              <div dir="rtl" className={cn('mt-1 w-full truncate font-black', big ? 'text-xl' : 'text-base')}>
                {r.name}
                {r.streamer ? ' 🎙️' : ''}
              </div>
              <div dir="rtl" className={cn('mb-2 font-black tabular-nums', p.text, big ? 'text-lg' : 'text-sm')}>{r.score} نقطة</div>
              <div className={cn('grid w-full place-items-center rounded-t-xl border border-b-0 bg-linear-to-b', p.height, p.tone)}>
                <span dir="rtl" className={cn('font-black', p.text, big ? 'text-2xl' : 'text-lg')}>
                  {p.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
