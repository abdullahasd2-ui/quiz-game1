import { ANSWER_SECONDS, canAdvance, GUESS_SECONDS, HIDE_SECONDS, type HideOutcome, type RoomView, type TeamIndex } from '@quiz/shared';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { haptic } from '@/lib/native';
import { cn } from '@/lib/utils';
import { send } from '../connection';
import { Countdown, Modal, Scorebar, TEAM_TINT, teamName, WaitDots } from '../ui';

const OUTCOME_TEXT: Record<HideOutcome, { icon: string; title: (guesser: string, hider: string) => string }> = {
  hit: { icon: '🎯', title: (g) => `${g} لقوا المفتاح!` },
  miss: { icon: '🔒', title: (_, h) => `${h} خبّوه صح — النقاط لهم!` },
  timeout: { icon: '⏰', title: (_, h) => `انتهى الوقت — النقاط لـ${h}` },
  'hint-failed': { icon: '💡', title: (_, h) => `غلطوا في سؤال التلميح — النقاط لـ${h}` },
};

/** The whole "خبّي أو اكشف" round: hide → guess (⇄ hint question) → result. */
export function HideScreen({ view, deadline }: { view: RoomView; deadline: number | null }) {
  const hide = view.hide!;
  const hider = view.turn;
  const guesser = (hider === 0 ? 1 : 0) as TeamIndex;
  const you = view.you;
  const isMember = view.role === 'member';
  const onHiders = you === hider;
  const onGuessers = you === guesser;
  const [busy, setBusy] = useState(false);
  useEffect(() => setBusy(false), [view.phase, hide.locked, hide.eliminated.length]);

  const phase = view.phase;
  const mayAct = (phase === 'hide' && onHiders) || ((phase === 'guess' || phase === 'hint') && onGuessers);
  const count = (key: string) => view.votes?.counts[key] ?? 0;
  const voted = (key: string) => view.votes?.mine === key;

  async function run(call: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    const res = await call();
    if (!res.ok) {
      setBusy(false);
      toast.error(('error' in res && res.error) || 'حصل خطأ');
    }
  }
  const vote = (key: string) => run(() => send('game:vote', { key }));
  const pickBox = (box: number) => {
    if (isMember) return vote(String(box));
    return run(() => (phase === 'hide' ? send('game:hide', { box }) : send('game:guess', { box })));
  };
  const askHint = () => (isMember ? vote('hint') : run(() => send('game:hint')));
  const pickOption = (index: number) => (isMember ? vote(String(index)) : run(() => send('game:answer', { index })));

  const total = phase === 'hide' ? HIDE_SECONDS : phase === 'guess' ? GUESS_SECONDS : ANSWER_SECONDS;
  const hiderName = teamName(view, hider);
  const guesserName = teamName(view, guesser);

  const status =
    phase === 'hide'
      ? onHiders
        ? isMember
          ? 'صوّت على الصندوق اللي نخبّي فيه المفتاح — الرئيس يقرر'
          : 'اختار الصندوق اللي تخبّي فيه المفتاح 🔑'
        : `${hiderName} يخبّون المفتاح...`
      : phase === 'guess'
        ? onGuessers
          ? isMember
            ? 'صوّت على الصندوق — الرئيس يقرر'
            : 'وين المفتاح؟ افتح صندوقاً!'
          : `${guesserName} يدوّرون على المفتاح...`
        : phase === 'hint'
          ? onGuessers
            ? 'جاوب صح وتنشال نص الصناديق، غلط وتروح النقاط للخصم!'
            : `${guesserName} يجاوبون سؤال التلميح...`
          : '';

  const q = view.question;
  const showResult = phase === 'result' && hide.result;

  return (
    <div className="animate-fade-up">
      <Scorebar view={view} highlightTurn />
      <div className="mb-1 text-center text-[11px] text-white/40">
        الجولة {hide.round} من {hide.totalRounds} · {hide.points} نقطة
      </div>
      {phase !== 'result' && <Countdown deadline={deadline} total={total} />}
      <div className="mb-3 text-center text-[13px] text-white/60">
        <b className="text-q-gold">{status}</b>
      </div>

      {phase === 'hint' && q ? (
        <div className="q-card mb-3">
          <div className="mb-1 text-center text-[11px] text-white/40">💡 سؤال التلميح</div>
          <div className="mb-3 text-center text-[15px] leading-relaxed font-black">{q.text}</div>
          <div className="grid grid-cols-2 gap-2">
            {q.options.map((opt, i) => (
              <button
                key={i}
                type="button"
                disabled={!(onGuessers) || busy}
                onClick={() => pickOption(i)}
                className={cn(
                  'rounded-xl border-[1.5px] border-q-line bg-q-bg px-3 py-3.5 text-sm font-bold transition-colors',
                  onGuessers && 'hover:border-q-gold hover:bg-q-gold/6',
                  onGuessers && voted(String(i)) && 'border-q-cyan bg-q-cyan/10',
                  !onGuessers && 'cursor-default',
                )}
              >
                {opt}
                {onGuessers && count(String(i)) > 0 && <span className="ms-1.5 text-[11px] font-bold text-q-cyan">🗳️ {count(String(i))}</span>}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-5 gap-2">
            {Array.from({ length: hide.boxes }, (_, i) => {
              const out = hide.eliminated.includes(i);
              const mine = hide.hidden === i && phase !== 'result';
              const n = mayAct ? count(String(i)) : 0;
              const canTap = mayAct && !out && !busy && !(phase === 'hide' && hide.locked);
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!canTap}
                  onClick={() => pickBox(i)}
                  aria-label={`صندوق ${i + 1}`}
                  className={cn(
                    'relative aspect-square rounded-xl border-[1.5px] border-q-gold/40 bg-linear-to-br from-[#2a1d0a] to-[#4a3210] text-2xl font-black transition-transform',
                    canTap && 'hover:-translate-y-0.5 hover:border-q-gold',
                    !canTap && 'cursor-default',
                    out && 'border-transparent bg-[#1a1a2a] opacity-30 grayscale',
                    mine && 'ring-2 ring-q-green',
                    canTap && voted(String(i)) && 'ring-2 ring-q-cyan',
                  )}
                >
                  {out ? '✖' : mine ? '🔑' : '📦'}
                  <span className="absolute start-1 top-0.5 text-[10px] text-white/50">{i + 1}</span>
                  {n > 0 && <span className="absolute inset-x-0 bottom-0.5 text-[10px] font-bold text-q-cyan">🗳️ {n}</span>}
                </button>
              );
            })}
          </div>

          {phase === 'guess' && onGuessers && (
            <button
              type="button"
              disabled={hide.hintUsed || busy}
              onClick={askHint}
              className={cn(
                'mb-2 w-full rounded-xl border-[1.5px] border-q-cyan/50 bg-q-cyan/10 px-3 py-3 text-sm font-black text-q-cyan transition-colors',
                !hide.hintUsed && 'hover:bg-q-cyan/20',
                hide.hintUsed && 'opacity-40',
                voted('hint') && 'ring-2 ring-white',
              )}
            >
              💡 تلميح
              {count('hint') > 0 && <span className="ms-1.5 rounded-full bg-black/30 px-2 py-0.5 text-[11px]">🗳️ {count('hint')}</span>}
              <small className="block text-[10px] font-normal opacity-80">
                {hide.hintUsed
                  ? hide.hintResult === 'correct'
                    ? 'استُخدم — واستُبعد نص الصناديق'
                    : 'استُخدم'
                  : 'جاوب سؤال متوسط: صح = نص الصناديق تنشال، غلط = النقاط للخصم'}
              </small>
            </button>
          )}
          {phase === 'guess' && !onGuessers && hide.hintUsed && hide.hintResult === 'correct' && (
            <div className="mb-2 text-center text-xs text-q-cyan">💡 الخصم جاوب التلميح صح — استُبعد نص الصناديق</div>
          )}
        </>
      )}

      {phase !== 'result' && !mayAct && (
        <div className="p-2 text-center text-xs text-white/50">
          <WaitDots /> {onHiders || onGuessers ? 'في انتظار الفريق الثاني...' : 'اللعب على جوالات الفرق'}
        </div>
      )}

      {showResult && <HideResultModal view={view} guesserName={guesserName} hiderName={hiderName} />}
    </div>
  );
}

function HideResultModal({ view, guesserName, hiderName }: { view: RoomView; guesserName: string; hiderName: string }) {
  const r = view.hide!.result!;
  const [busy, setBusy] = useState(false);
  const myDelta = view.you !== 'tv' ? r.deltas[view.you] : null;
  useEffect(() => {
    if (myDelta !== null) haptic(myDelta > 0 ? 'success' : 'error');
  }, [myDelta]);
  const mayAdvance = canAdvance(view.mode, view.you) && view.role !== 'member';
  const lastRound = view.hide!.round >= view.hide!.totalRounds;
  const o = OUTCOME_TEXT[r.outcome];

  async function next() {
    setBusy(true);
    const res = await send('game:next');
    setBusy(false);
    if (!res.ok) toast.error(res.error);
  }

  return (
    <Modal open>
      <div className="mb-2 text-5xl">{o.icon}</div>
      <h2 className="mb-3 text-xl font-black">{o.title(guesserName, hiderName)}</h2>
      <div className="mb-3 rounded-lg bg-q-green/10 px-3 py-2 text-sm text-[#2ecc71]">
        🔑 كان المفتاح في الصندوق رقم <b>{r.hidden + 1}</b>
        {r.guess !== null && r.guess !== r.hidden && <span className="text-white/60"> · فتحوا الصندوق {r.guess + 1}</span>}
      </div>
      <div className="mb-3.5 grid grid-cols-2 gap-2.5">
        {([0, 1] as const).map((t) => (
          <div key={t} className={cn('rounded-xl border px-2 py-3', TEAM_TINT[t])}>
            <div className="mb-1 truncate text-[11px] text-white/50">{teamName(view, t)}</div>
            <div className={cn('text-xl font-black tabular-nums', r.deltas[t] > 0 ? 'text-q-gold' : 'text-white/50')}>
              <bdi dir="ltr">{r.deltas[t] > 0 ? `+${r.deltas[t]}` : r.deltas[t]}</bdi> نقطة
            </div>
          </div>
        ))}
      </div>
      {mayAdvance ? (
        <button type="button" className="q-btn-gold" onClick={next} disabled={busy}>
          {lastRound ? 'النتيجة النهائية 🏆' : 'التالي ←'}
        </button>
      ) : (
        <div className="text-xs text-white/50">
          <WaitDots /> {view.mode === 'tv' ? 'التلفاز ينتقل للجولة التالية...' : 'في انتظار الانتقال...'}
        </div>
      )}
    </Modal>
  );
}
