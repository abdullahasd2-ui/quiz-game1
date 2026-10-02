import { ACTION_SECONDS, ANSWER_SECONDS, type Action, type RoomView, type TeamIndex } from '@quiz/shared';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { send } from '../connection';
import { actionLabel, Countdown, QuestionImage, Scorebar, TEAM_TINT, teamName, WaitDots } from '../ui';

function useCategory(view: RoomView) {
  return view.categories.find((c) => c.id === view.question?.categoryId);
}

function optionTone(view: RoomView, i: number, mine: number | null) {
  const r = view.result;
  if (r) {
    if (i === r.correctIndex) return 'border-q-green bg-q-green/12 text-[#2ecc71]';
    if (r.answers.includes(i)) return 'border-q-red bg-q-red/12 text-q-red';
    return 'border-q-line opacity-60';
  }
  if (i === mine) return 'border-q-blue bg-q-blue/10';
  return 'border-q-line';
}

/** A team's phone during a round. */
export function QuestionScreen({ view, deadline }: { view: RoomView; deadline: number | null }) {
  const q = view.question!;
  const cat = useCategory(view);
  const team = view.you as TeamIndex;
  const other = (team === 0 ? 1 : 0) as TeamIndex;
  const lbl = actionLabel(view.variant);
  // Optimistic lock so a double tap doesn't send twice; the server state replaces it.
  const [sent, setSent] = useState<'action' | 'answer' | null>(null);
  useEffect(() => setSent(null), [view.phase, view.myAction, view.myAnswer]);

  async function act(action: Action) {
    setSent('action');
    const res = await send('game:action', { action });
    if (!res.ok) {
      setSent(null);
      toast.error(res.error);
    }
  }
  async function answer(index: number) {
    setSent('answer');
    const res = await send('game:answer', { index });
    if (!res.ok) {
      setSent(null);
      toast.error(res.error);
    }
  }

  const stole = view.myAction === 'steal';
  const canAnswer = view.phase === 'answer' && !stole && view.myAnswer === null && sent !== 'answer';

  return (
    <div className="animate-fade-up">
      <Scorebar view={view} />
      <Countdown deadline={deadline} total={view.phase === 'answer' ? ANSWER_SECONDS : ACTION_SECONDS} />

      <div className="mb-2.5 rounded-2xl border border-q-line bg-q-panel p-4">
        <div className="mb-1.5 text-[11px] font-bold tracking-widest text-q-gold">
          {cat?.icon} {cat?.name}
        </div>
        <div className="mb-2 inline-block rounded-lg border border-q-cyan/30 bg-q-cyan/15 px-2.5 py-0.5 text-xs font-bold text-q-cyan">{q.points} نقطة</div>
        <div className="text-[17px] leading-relaxed font-bold">{q.text}</div>
        <QuestionImage url={q.imageUrl} type={q.type} revealed={view.phase === 'result'} />
      </div>

      {view.phase === 'action' &&
        (view.myAction === null && sent !== 'action' ? (
          <>
            <div className="mb-2 text-center text-[13px] text-white/50">
              اختار قرارك <b className="text-white">سراً</b>
            </div>
            <div className="mb-2.5 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => act('steal')}
                className="rounded-xl bg-linear-to-br from-q-red to-[#c0392b] px-3 py-4 text-sm leading-normal font-black transition-transform hover:-translate-y-0.5"
              >
                {lbl.icon} {lbl.short}
                <small className="block text-[10px] opacity-80">{lbl.desc}</small>
              </button>
              <button
                type="button"
                onClick={() => act('answer')}
                className="rounded-xl bg-linear-to-br from-q-green to-[#1e8449] px-3 py-4 text-sm leading-normal font-black transition-transform hover:-translate-y-0.5"
              >
                ✅ جاوب
                <small className="block text-[10px] opacity-80">أجاوب بنفسي</small>
              </button>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-q-gold/25 bg-q-gold/8 p-3.5 text-center">
            <div className="mb-1 text-3xl">{view.myAction === 'steal' ? lbl.icon : view.myAction ? '✅' : '🔒'}</div>
            <div className="text-sm font-bold text-q-gold">
              {view.myAction === 'steal' ? `اخترت ال${lbl.full}!` : view.myAction ? 'اخترت الإجابة!' : 'قرارك محفوظ!'}
            </div>
            <div className="mt-1 text-[11px] text-white/50">
              <WaitDots /> {view.decided[other] ? 'الفريق الثاني اختار — لحظات...' : 'في انتظار قرار الفريق الثاني'}
            </div>
          </div>
        ))}

      {view.phase !== 'action' && (
        <>
          <div className="mb-2 text-center text-[13px] text-white/50">
            {view.phase === 'result' ? (
              <b className="text-white">النتيجة</b>
            ) : stole ? (
              <>
                {lbl.icon} <b className="text-white">اخترت ال{lbl.full}</b> — في انتظار جواب الخصم...
              </>
            ) : canAnswer ? (
              <b className="text-white">اختار إجابتك</b>
            ) : (
              <b className="text-white">انتظار الفريق الثاني...</b>
            )}
          </div>
          <div className="mb-2.5 grid grid-cols-2 gap-2">
            {q.options.map((opt, i) => (
              <button
                key={i}
                type="button"
                disabled={!canAnswer}
                onClick={() => answer(i)}
                className={cn(
                  'rounded-xl border-[1.5px] bg-q-bg px-3 py-3.5 text-sm font-bold transition-colors',
                  optionTone(view, i, view.myAnswer),
                  canAnswer && 'hover:border-q-gold hover:bg-q-gold/6',
                  !canAnswer && 'cursor-default',
                )}
              >
                {opt}
              </button>
            ))}
          </div>
          {view.phase === 'answer' && !canAnswer && (
            <div className="p-2.5 text-center text-xs text-white/50">
              <WaitDots /> في انتظار إجابة الفريق الثاني...
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** The TV in tv mode: big question, options, and whether each team has locked in. */
export function TvQuestionScreen({ view, deadline }: { view: RoomView; deadline: number | null }) {
  const q = view.question!;
  const cat = useCategory(view);
  const lbl = actionLabel(view.variant);

  return (
    <div className="animate-fade-up">
      <Scorebar view={view} />
      <Countdown deadline={deadline} total={view.phase === 'answer' ? ANSWER_SECONDS : ACTION_SECONDS} />
      <div className="mb-4 rounded-3xl border-2 border-q-gold bg-q-panel p-6 text-center sm:p-8">
        <div className="mb-2.5 text-[13px] font-bold tracking-widest text-q-gold">
          {cat?.icon} {cat?.name}
        </div>
        <div className="mb-3.5 text-xl font-black text-q-cyan">{q.points} نقطة</div>
        <div className="text-2xl leading-normal font-bold">{q.text}</div>
        <QuestionImage url={q.imageUrl} type={q.type} revealed={view.phase === 'result'} large />
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {q.options.map((opt, i) => (
            <div key={i} className={cn('rounded-xl border-2 bg-q-bg p-3.5 text-base font-bold transition-all', optionTone(view, i, null))}>
              {opt}
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {([0, 1] as const).map((t) => {
          const action = view.result?.actions[t];
          const [icon, txt] = action
            ? [action === 'steal' ? lbl.icon : '✅', action === 'steal' ? lbl.short : 'أجاب']
            : view.phase === 'answer'
              ? ['🔒', 'قرّر — يجاوب الآن...']
              : view.decided[t]
                ? ['🔒', 'اختار قراره — ينتظر...']
                : ['⏳', 'في انتظار القرار...'];
          return (
            <div key={t} className={cn('rounded-xl border p-3 text-center', TEAM_TINT[t])}>
              <div className="mb-1 text-[11px] text-white/50">{teamName(view, t)}</div>
              <div className="mb-0.5 text-xl">{icon}</div>
              <div className="text-xs text-white/80">{txt}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
