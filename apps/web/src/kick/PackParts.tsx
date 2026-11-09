import { droppedBy, pointsAt, type StreamQuestion } from '@quiz/shared';
import { cn } from '@/lib/utils';

/** The member a fact question is about: their picture and name above the question. */
export function AboutBadge({ q, big = false }: { q: StreamQuestion; big?: boolean }) {
  if (!q.about) return null;
  return (
    <div className="mb-3 flex items-center justify-center gap-3">
      <img src={q.about.image} alt="" className={cn('rounded-2xl border-2 border-q-gold/60 object-cover shadow-[0_0_24px_-8px_rgba(247,201,72,0.8)]', big ? 'size-20' : 'size-14')} />
      <div className="text-start">
        <div className="text-xs text-white/60">سؤال عن</div>
        <div className={cn('font-black text-q-gold', big ? 'text-3xl' : 'text-xl')}>{q.about.name}</div>
      </div>
    </div>
  );
}

/**
 * «مين فينا؟»: the members' faces, numbered 1-8. During the answer time wrong faces drop out one by one (`now` and
 * `answerAt` by the control page's clock); `correct` lights the answer up once revealed; `onPick` for the streamer.
 */
export function FaceGrid({
  q,
  answerAt,
  now,
  correct = null,
  mine = null,
  onPick,
  big = false,
}: {
  q: StreamQuestion;
  answerAt?: number;
  now: number;
  correct?: number | null;
  mine?: number | null;
  onPick?: (i: number) => void;
  big?: boolean;
}) {
  const gone = new Set((q.eliminate ?? []).slice(0, correct === null ? droppedBy(q, answerAt, now) : 0));
  const live = correct === null && answerAt !== undefined && q.decay;
  return (
    <div>
      {live && (
        <div className="mb-2 text-center text-sm text-white/70">
          النقاط الحين: <b className="text-q-gold tabular-nums">{pointsAt(q, answerAt, now)}</b> — تنزل مع كل صورة تطلع
        </div>
      )}
      <div dir="ltr" className="grid grid-cols-4 gap-2 sm:gap-3">
        {(q.faces ?? []).map((src, i) => {
          const out = gone.has(i);
          const right = correct === i;
          return (
            <button
              key={i}
              type="button"
              disabled={!onPick || out}
              onClick={() => onPick?.(i)}
              className={cn(
                'relative overflow-hidden rounded-2xl border-2 bg-q-panel text-center transition-all duration-500',
                right ? 'z-10 scale-105 border-q-green shadow-[0_0_34px_-6px_rgba(46,204,113,0.95)] motion-safe:animate-stamp' : correct !== null ? 'border-q-line opacity-35 grayscale' : mine === i ? 'border-q-gold' : 'border-q-line',
                out && 'scale-90 opacity-15 grayscale',
                onPick && !out && 'hover:-translate-y-1 hover:border-q-gold',
              )}
            >
              <img src={src} alt="" className="aspect-square w-full object-cover" />
              <div className="flex items-center justify-center gap-1.5 py-1.5" dir="rtl">
                <span className={cn('grid shrink-0 place-items-center rounded-md bg-q-gold/20 font-black text-q-gold', big ? 'size-7 text-base' : 'size-6 text-sm')}>{i + 1}</span>
                <span className={cn('truncate font-black', big ? 'text-lg' : 'text-sm')}>{q.options[i]}</span>
              </div>
              {out && <div className="absolute inset-0 grid place-items-center text-5xl">✖️</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
