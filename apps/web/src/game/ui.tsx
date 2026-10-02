import type { QuestionType, RoomView, TeamIndex, Variant } from '@quiz/shared';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function actionLabel(variant: Variant) {
  return variant === 'flip'
    ? { icon: '🔀', short: 'اقلب', full: 'قلب', desc: 'اقلب جواب الخصم' }
    : { icon: '🔄', short: 'بادل', full: 'مبادلة', desc: 'بادل جواب الخصم' };
}

export const TEAM_TEXT = ['text-q-blue', 'text-q-red'] as const;
export const TEAM_TINT = ['border-q-blue/30 bg-q-blue/10', 'border-q-red/30 bg-q-red/10'] as const;
export const teamName = (view: RoomView, t: TeamIndex) => view.teams[t]?.name ?? (t === 0 ? 'الفريق الأول' : 'الفريق الثاني');

export function WaitDots() {
  return (
    <span className="q-wait-dots" aria-hidden>
      <span />
      <span />
      <span />
    </span>
  );
}

const BG_WORDS = ['جاوب', 'بادل', '🔄', '✅', 'نقاط', 'صح', 'غلط', 'دبل'];

/** Words drifting up behind the screens, as on the original page. */
export function FloatingWords() {
  const words = useMemo(
    () =>
      Array.from({ length: 50 }, (_, i) => ({
        id: i,
        text: BG_WORDS[Math.floor(Math.random() * BG_WORDS.length)],
        left: `${Math.random() * 100}%`,
        fontSize: `${12 + Math.random() * 20}px`,
        animationDuration: `${8 + Math.random() * 20}s`,
        animationDelay: `${-Math.random() * 25}s`,
      })),
    [],
  );
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-10" aria-hidden>
      {words.map(({ id, text, ...style }) => (
        <span key={id} className="absolute font-black whitespace-nowrap animate-float-word" style={style}>
          {text}
        </span>
      ))}
    </div>
  );
}

export function Scorebar({ view, highlightTurn = false }: { view: RoomView; highlightTurn?: boolean }) {
  return (
    <div className="mb-3 grid grid-cols-[1fr_36px_1fr] items-center gap-2">
      {([0, 1] as const).map((t) => (
        <div
          key={t}
          className={cn(
            'rounded-xl border border-q-line bg-q-panel p-2.5 text-center',
            highlightTurn && view.turn === t && 'ring-2 ring-q-gold',
            t === 1 && 'order-3',
          )}
        >
          <div className="flex items-center justify-center gap-1 truncate text-[11px] text-white/50">
            {view.teams[t] && !view.teams[t].connected && <span title="غير متصل">📵</span>}
            <span className="truncate">{teamName(view, t)}</span>
          </div>
          <div className={cn('text-2xl font-black tabular-nums', TEAM_TEXT[t])}>{view.teams[t]?.score ?? 0}</div>
        </div>
      ))}
      <div className="order-2 text-center text-sm font-black text-white/25">VS</div>
    </div>
  );
}

/** Counts down to a local deadline; the server enforces the real one. */
export function Countdown({ deadline, total }: { deadline: number | null; total: number }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (deadline === null) return;
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [deadline]);
  if (deadline === null) return null;
  const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  const pct = Math.min(100, (left / total) * 100);
  return (
    <div className="mb-3">
      <div className="mb-1.5 text-center text-[13px] text-white/50">
        ⏱ <b className="text-q-gold tabular-nums">{left}</b> ثانية
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#1a1a30]">
        <div
          className={cn(
            'h-full rounded-full bg-linear-to-l transition-[width] duration-1000 ease-linear',
            left <= 10 ? 'from-[#c0392b] to-q-red' : 'from-q-gold to-q-green',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/**
 * "image" questions (e.g. brand logos) are shown blurred until the result, like the old canvas drawings;
 * "reveal"/"zoom" show their teaser image and swap to the full one in the result.
 */
export function QuestionImage({ url, type, revealed = false, large = false }: { url: string | null; type: QuestionType; revealed?: boolean; large?: boolean }) {
  if (!url || type === 'text') return null;
  const blurred = type === 'image' && !revealed;
  return (
    <div className="mt-2.5 mb-1 flex flex-col items-center justify-center overflow-hidden rounded-xl bg-q-bg p-2.5">
      <img
        src={url}
        alt=""
        className={cn('max-w-full rounded-lg object-contain transition-[filter] duration-500', large ? 'max-h-64' : 'max-h-44', blurred && 'blur-md')}
      />
      {!revealed && <div className="mt-1.5 text-[11px] text-white/50">🔍 {blurred ? 'اكتشف الصورة المغبشة!' : 'اكتشف الصورة!'}</div>}
    </div>
  );
}

export function Modal({ open, onClose, children }: { open: boolean; onClose?: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/88 p-4" onClick={onClose} role="dialog" aria-modal>
      <div
        className="max-h-[90dvh] w-full max-w-md animate-pop-in overflow-y-auto rounded-2xl border border-q-line bg-q-panel px-5 py-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
