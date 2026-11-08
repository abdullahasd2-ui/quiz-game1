import { POINTS } from '@quiz/shared';
import { cn } from '@/lib/utils';

/** The category × points board. Clickable on the broadcast page; the control page shows it read-only. */
export function BoardGrid({
  board,
  used,
  onPick,
  disabled = false,
  big = false,
}: {
  board: { id: number; name: string; icon: string }[];
  used: string[];
  onPick?: (category: number, points: number) => void;
  disabled?: boolean;
  big?: boolean;
}) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${board.length}, minmax(0, 1fr))` }}>
      {board.map((c) => (
        <div key={c.id} className={cn('truncate rounded-lg bg-q-panel px-1 py-2 text-center font-black', big ? 'text-sm' : 'text-xs')}>
          <div className={big ? 'text-2xl' : 'text-lg'}>{c.icon}</div>
          {c.name}
        </div>
      ))}
      {POINTS.flatMap((p) =>
        board.map((c) => {
          const isUsed = used.includes(`${c.id}:${p}`);
          const clickable = Boolean(onPick) && !isUsed && !disabled;
          return (
            <button
              key={`${c.id}:${p}`}
              type="button"
              disabled={!clickable}
              onClick={() => onPick?.(c.id, p)}
              className={cn(
                'rounded-lg border-2 font-black transition-all',
                big ? 'py-4 text-2xl' : 'py-3 text-lg',
                isUsed
                  ? 'border-transparent bg-white/5 text-white/15'
                  : clickable
                    ? 'border-q-line bg-q-panel text-q-gold hover:-translate-y-0.5 hover:border-q-gold hover:shadow-[0_0_18px_-6px_rgba(247,201,72,0.6)]'
                    : 'border-q-line bg-q-panel text-q-gold',
              )}
            >
              {p}
            </button>
          );
        }),
      )}
    </div>
  );
}
