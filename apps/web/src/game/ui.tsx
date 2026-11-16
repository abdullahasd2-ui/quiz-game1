import type { Action, QuestionType, RoomView, TeamIndex, Variant } from '@quiz/shared';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { serverUrl } from '@/lib/server';
import { cn } from '@/lib/utils';
import { play } from './fx/sound';

export function actionLabel(variant: Variant) {
  return variant === 'flip'
    ? { icon: '🔀', short: 'اقلب', full: 'قلب', desc: 'اقلب جواب الخصم' }
    : { icon: '🔄', short: 'بادل', full: 'مبادلة', desc: 'بادل جواب الخصم' };
}

/** Icon and wording for a team's chosen action (answering, or swap/flip/reverse). */
export function actionInfo(variant: Variant, action: Action) {
  if (action === 'answer') return { icon: '✅', short: 'جاوب', full: 'إجابة', desc: 'أجاوب بنفسي' };
  if (action === 'reverse') return { icon: '↩️', short: 'اعكس', full: 'عكس', desc: 'جاوب صح = ينقص منك، غلط = يزيد لك' };
  return actionLabel(variant);
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

const TEAM_LOOK = [
  { avatar: '🦁', glow: 'shadow-[0_0_30px_-10px_#3498db]', bg: 'from-q-blue/25 to-q-blue/5', edge: 'border-q-blue/40', bar: 'bg-q-blue' },
  { avatar: '🐯', glow: 'shadow-[0_0_30px_-10px_#e74c3c]', bg: 'from-q-red/25 to-q-red/5', edge: 'border-q-red/40', bar: 'bg-q-red' },
] as const;

/** The two teams face to face: avatar, name, big score (bumps when it changes), whose turn it is and the 🔥 streak. */
export function Scorebar({ view, highlightTurn = false }: { view: RoomView; highlightTurn?: boolean }) {
  const a = Math.max(0, view.teams[0]?.score ?? 0);
  const b = Math.max(0, view.teams[1]?.score ?? 0);
  const lead = a + b > 0 ? (a / (a + b)) * 100 : 50;
  return (
    <div className="mb-3">
      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
        {([0, 1] as const).map((t) => {
          const look = TEAM_LOOK[t];
          const turn = highlightTurn && view.turn === t;
          return (
            <div
              key={t}
              className={cn(
                'relative overflow-hidden rounded-2xl border bg-linear-to-b p-2.5 text-center backdrop-blur transition-all',
                look.bg,
                look.edge,
                turn && cn('ring-2 ring-q-gold', look.glow),
                t === 1 && 'order-3',
              )}
            >
              {turn && <div className="absolute inset-x-0 top-0 bg-q-gold py-px text-[10px] font-black text-black">🎯 دوره يختار</div>}
              <div className={cn('flex items-center justify-center gap-1.5 truncate text-[12px] font-bold text-white/75', turn && 'mt-3')}>
                <span className="text-base" aria-hidden>
                  {look.avatar}
                </span>
                {view.teams[t] && !view.teams[t].connected && <span title="غير متصل">📵</span>}
                <span className="truncate">{teamName(view, t)}</span>
              </div>
              {/* Keyed by the score so a change replays the bump. */}
              <div key={view.teams[t]?.score ?? 0} className={cn('q-display text-4xl leading-tight tabular-nums motion-safe:animate-fx-bump', TEAM_TEXT[t])}>
                {view.teams[t]?.score ?? 0}
              </div>
              {/* Streak: one 🔥 per right answer in a row; at two the next right answer is doubled. */}
              {(view.streaks?.[t] ?? 0) > 0 && (
                <div className={cn('text-[11px] font-black', view.streaks![t] >= 2 ? 'text-q-orange motion-safe:animate-streak' : 'text-white/60')} title="إجابات صحيحة ورا بعض">
                  {'🔥'.repeat(view.streaks![t])}
                  {view.streaks![t] >= 2 && ' الجاية دبل!'}
                </div>
              )}
            </div>
          );
        })}
        <div className="order-2 grid place-items-center">
          <span className="q-display grid size-10 place-items-center rounded-full border border-white/15 bg-black/40 text-sm text-white/60 shadow-inner">VS</span>
        </div>
      </div>
      {/* Tug of war: who is ahead, at a glance (and from across the room on a TV). */}
      <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-white/5" role="img" aria-label="الفرق بين الفريقين">
        <div className="bg-q-blue transition-[width] duration-700" style={{ width: `${lead}%` }} />
        <div className="flex-1 bg-q-red" />
      </div>
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
  const left = deadline === null ? null : Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  // The last ten seconds tick, the last three tick faster.
  useEffect(() => {
    if (left !== null && left > 0 && left <= 10) play(left <= 3 ? 'tickUrgent' : 'tick');
  }, [left]);
  if (deadline === null || left === null) return null;
  const pct = Math.min(100, (left / total) * 100);
  const urgent = left <= 10;
  return (
    <div className="mb-3 flex items-center gap-3" role="timer" aria-live="off" aria-label={`باقي ${left} ثانية`}>
      <div className={cn('relative grid size-12 shrink-0 place-items-center', urgent && left <= 3 && 'motion-safe:animate-fx-shake')}>
        <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
          <circle
            cx="18"
            cy="18"
            r="15.9"
            fill="none"
            stroke={urgent ? '#e74c3c' : '#f7c948'}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${pct} 100`}
            className="transition-[stroke-dasharray] duration-1000 ease-linear"
          />
        </svg>
        <b className={cn('q-display relative text-xl tabular-nums', urgent ? 'text-q-red' : 'text-q-gold')}>{left}</b>
      </div>
      <div className="flex-1">
        <div className="mb-1 text-[12px] text-white/55">{urgent ? '⚠️ الوقت يخلص!' : '⏱ الوقت المتبقي'}</div>
        <div className="h-2 overflow-hidden rounded-full bg-[#1a1a30]">
          <div
            className={cn('h-full rounded-full bg-linear-to-l transition-[width] duration-1000 ease-linear', urgent ? 'from-[#c0392b] to-q-red' : 'from-q-gold to-q-green')}
            style={{ width: `${pct}%` }}
          />
        </div>
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
        src={serverUrl(url)}
        alt=""
        className={cn('max-w-full rounded-lg object-contain transition-[filter] duration-500', large ? 'max-h-64' : 'max-h-44', blurred && 'blur-md')}
      />
      {!revealed && <div className="mt-1.5 text-[11px] text-white/50">🔍 {blurred ? 'اكتشف الصورة المغبشة!' : 'اكتشف الصورة!'}</div>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  children,
  className,
  animation = 'animate-pop-in',
}: {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
  /** Replaces the default pop-in (an `animate-*` class), since two animation classes would override each other. */
  animation?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal>
      <div
        className={cn('q-card max-h-[90dvh] w-full max-w-md overflow-y-auto px-5 py-6 text-center', animation, className)}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/** The way into a game: mode → room → play. `at` is the current step (0-based); earlier steps show as done. */
export function Steps({ at, labels = ['الطور', 'الغرفة', 'اللعب'], className }: { at: number; labels?: string[]; className?: string }) {
  return (
    <ol className={cn('flex items-center justify-center gap-1.5 text-[11px] font-black', className)} aria-label="خطوات بدء اللعبة">
      {labels.map((l, i) => (
        <li key={l} className="flex items-center gap-1.5" aria-current={i === at ? 'step' : undefined}>
          <span
            className={cn(
              'grid size-5 place-items-center rounded-full text-[10px] transition-all',
              i < at ? 'bg-q-green text-black' : i === at ? 'bg-q-gold text-black ring-4 ring-q-gold/25' : 'bg-white/10 text-white/50',
            )}
          >
            {i < at ? '✓' : i + 1}
          </span>
          <span className={i === at ? 'text-white' : 'text-white/50'}>{l}</span>
          {i < labels.length - 1 && <span className={cn('h-px w-6 sm:w-10', i < at ? 'bg-q-green' : 'bg-white/15')} aria-hidden />}
        </li>
      ))}
    </ol>
  );
}
