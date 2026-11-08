import { STREAM_HIDE_BOXES, STREAM_HIDE_SHOW_MS, type HideShuffle } from '@quiz/shared';
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

const COLS = 5;

/** Slot each box sits in after `k` swaps (box i starts in slot i). */
function slotsAfter(sh: HideShuffle, k: number): number[] {
  const slotOf = Array.from({ length: STREAM_HIDE_BOXES }, (_, i) => i);
  const boxAt = [...slotOf];
  for (const [a, b] of sh.swaps.slice(0, k)) {
    const x = boxAt[a]!;
    const y = boxAt[b]!;
    boxAt[a] = y;
    boxAt[b] = x;
    slotOf[x] = b;
    slotOf[y] = a;
  }
  return slotOf;
}

/**
 * The shell game: the key sits in its box in sight, the boxes close and trade places pair by pair (faster for more
 * points), then they stop over the fixed numbers 1-10 the chat guesses with. `reveal` opens the key's box.
 * `hostNow` is the control page's clock (the shuffle is timed by it).
 */
export function ShuffleBoxes({ shuffle, startAt, hostNow, reveal = false, big = false }: { shuffle: HideShuffle; startAt: number; hostNow: () => number; reveal?: boolean; big?: boolean }) {
  const total = shuffle.swaps.length;
  const [step, setStep] = useState(0);
  const [showing, setShowing] = useState(true);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const t = hostNow() - startAt;
      setShowing(t < STREAM_HIDE_SHOW_MS);
      const k = t < STREAM_HIDE_SHOW_MS ? 0 : Math.min(total, Math.floor((t - STREAM_HIDE_SHOW_MS) / shuffle.ms) + 1);
      setStep(k);
      if (k < total || t < STREAM_HIDE_SHOW_MS) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [shuffle, startAt, hostNow, total]);

  const slotOf = useMemo(() => slotsAfter(shuffle, step), [shuffle, step]);
  const keyBox = shuffle.from;
  const moving = step > 0 && step < total;

  return (
    <div dir="ltr" className="select-none">
      <div className={cn('relative w-full', big ? 'h-[300px] sm:h-[340px]' : 'h-[230px] sm:h-[260px]')}>
        {/* Fixed numbered places under the boxes: the chat answers with these. */}
        {Array.from({ length: STREAM_HIDE_BOXES }, (_, slot) => (
          <div
            key={`slot-${slot}`}
            className="absolute flex items-end justify-center pb-1"
            style={{ left: `${(slot % COLS) * 20}%`, top: `${Math.floor(slot / COLS) * 50}%`, width: '20%', height: '50%' }}
          >
            <span className={cn('font-black text-q-gold', big ? 'text-2xl' : 'text-lg')}>{slot + 1}</span>
          </div>
        ))}
        {Array.from({ length: STREAM_HIDE_BOXES }, (_, box) => {
          const slot = slotOf[box]!;
          const isKey = box === keyBox;
          const open = (showing && isKey) || (reveal && isKey);
          return (
            <div
              key={`box-${box}`}
              className="absolute p-1.5 pb-8"
              style={{
                width: '20%',
                height: '50%',
                transform: `translate(${(slot % COLS) * 100}%, ${Math.floor(slot / COLS) * 100}%)`,
                transition: `transform ${Math.round(shuffle.ms * 0.85)}ms cubic-bezier(0.45, 0, 0.25, 1)`,
                zIndex: moving ? 2 : 1,
              }}
            >
              <div
                className={cn(
                  'flex h-full w-full items-center justify-center rounded-2xl border-2 transition-colors',
                  open && reveal ? 'border-q-green bg-q-green/20 shadow-[0_0_30px_-6px_rgba(46,204,113,0.9)]' : open ? 'border-q-gold bg-q-gold/15' : reveal ? 'border-q-line bg-white/5 opacity-50' : 'border-q-line bg-q-panel',
                )}
              >
                <span className={big ? 'text-5xl' : 'text-4xl'}>{open ? '🔑' : reveal ? '📭' : '📦'}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
