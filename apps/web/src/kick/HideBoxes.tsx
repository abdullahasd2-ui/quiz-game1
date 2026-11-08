import { STREAM_HIDE_BOXES } from '@quiz/shared';
import { cn } from '@/lib/utils';

/**
 * The 10 numbered boxes of «خبّي أو اكشف». `keyAt` shows where the key is (the streamer's own page, or everyone once
 * revealed); `revealed` opens all the boxes; `onPick` makes them clickable (the streamer hiding the key).
 */
export function HideBoxes({ keyAt = null, revealed = false, onPick, big = false }: { keyAt?: number | null; revealed?: boolean; onPick?: (i: number) => void; big?: boolean }) {
  return (
    <div dir="ltr" className="grid grid-cols-5 gap-2 sm:gap-3">
      {Array.from({ length: STREAM_HIDE_BOXES }, (_, i) => {
        const isKey = keyAt === i;
        return (
          <button
            key={i}
            type="button"
            disabled={!onPick}
            onClick={() => onPick?.(i)}
            className={cn(
              'relative flex aspect-square flex-col items-center justify-center rounded-2xl border-2 font-black transition-all',
              revealed && isKey
                ? 'border-q-green bg-q-green/20 shadow-[0_0_30px_-6px_rgba(46,204,113,0.9)] motion-safe:animate-stamp'
                : revealed
                  ? 'border-q-line bg-white/5 opacity-50'
                  : isKey
                    ? 'border-q-gold bg-q-gold/15'
                    : 'border-q-line bg-q-panel',
              onPick && 'hover:-translate-y-1 hover:border-q-gold hover:shadow-[0_0_20px_-6px_rgba(247,201,72,0.7)]',
            )}
          >
            <span className={big ? 'text-5xl' : 'text-3xl'}>{revealed ? (isKey ? '🔑' : '📭') : isKey ? '🔑' : '📦'}</span>
            <span className={cn('mt-1 text-q-gold', big ? 'text-2xl' : 'text-lg')}>{i + 1}</span>
          </button>
        );
      })}
    </div>
  );
}
