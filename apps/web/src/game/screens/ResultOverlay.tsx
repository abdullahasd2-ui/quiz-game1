import { canAdvance, isSpecial, POINTS, type RoomView } from '@quiz/shared';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { haptic } from '@/lib/native';
import { serverUrl } from '@/lib/server';
import { cn } from '@/lib/utils';
import { send } from '../connection';
import { Confetti } from '../fx/Confetti';
import { CountUp } from '../fx/CountUp';
import { actionInfo, actionLabel, Modal, TEAM_TINT, teamName, WaitDots } from '../ui';

export function ResultOverlay({ view }: { view: RoomView }) {
  const r = view.result;
  const [busy, setBusy] = useState(false);
  const myDelta = r && view.you !== 'tv' ? r.deltas[view.you] : null;
  useEffect(() => {
    if (myDelta !== null) haptic(myDelta > 0 ? 'success' : myDelta < 0 ? 'error' : 'tap');
  }, [myDelta]);
  if (!r || !view.question) return null;
  const q = view.question;
  const lbl = actionLabel(view.variant);
  const bothSteal = isSpecial(r.actions[0]) && isSpecial(r.actions[1]);
  const icon = bothSteal ? lbl.icon + lbl.icon : r.deltas.some((d) => d >= 200) ? '🔥' : r.deltas.some((d) => d < 0) ? '💀' : '🎯';
  // Reveal/zoom questions have a second "answer" picture; blurred logos are shown sharp.
  const picture = r.revealUrl ?? (q.type === 'image' ? q.imageUrl : null);
  const mayAdvance = canAdvance(view.mode, view.you) && view.role !== 'member';
  const lastRound = view.used.length >= view.categories.length * POINTS.length;

  async function next() {
    setBusy(true);
    const res = await send('game:next');
    setBusy(false);
    if (!res.ok) toast.error(res.error);
  }

  // What this seat sees: confetti and a golden glow when you scored, a shake when you lost points (the tv: any points).
  const won = (myDelta ?? Math.max(...r.deltas)) > 0;
  const lost = myDelta !== null && myDelta < 0;
  return (
    <Modal open animation={won ? 'motion-safe:animate-fx-win' : lost ? 'motion-safe:animate-fx-lose' : undefined} className={cn(won && 'border-q-gold/60', lost && 'border-q-red/50')}>
      {won && <Confetti />}
      <div key={String(won)} className="mb-2 text-5xl motion-safe:animate-fx-drop">
        {icon}
      </div>
      <h2 className="mb-3 text-xl font-black">{bothSteal ? `كلاهم ${view.variant === 'flip' ? 'قلبا' : 'بادلا'} — لا نقاط!` : 'نتيجة الجولة'}</h2>
      {picture && <img src={serverUrl(picture)} alt="" className="mx-auto mb-3.5 block max-h-56 max-w-full rounded-xl" />}
      {/* The answer lands like a stamp, then the two teams flip in one after the other and their totals roll up. */}
      <div className="mb-3 rounded-xl border border-q-green/40 bg-q-green/10 px-3 py-2.5 text-[#2ecc71] shadow-[0_0_24px_-10px_rgba(46,204,113,0.8)] motion-safe:animate-stamp" style={{ animationDelay: '0.15s' }}>
        <div className="text-[11px] text-[#2ecc71]/80">✅ الإجابة الصحيحة</div>
        <b className="text-lg">{q.options[r.correctIndex]}</b>
      </div>
      <div className="mb-3.5 grid grid-cols-2 gap-2.5">
        {([0, 1] as const).map((t) => {
          const stole = isSpecial(r.actions[t]);
          const info = actionInfo(view.variant, r.actions[t]);
          const ans = r.answers[t];
          const d = r.deltas[t];
          const total = view.teams[t]?.score ?? 0;
          const streak = r.streakBonus?.[t];
          const delay = 0.45 + t * 0.25;
          return (
            <div
              key={t}
              className={cn('relative rounded-xl border px-2 py-3 motion-safe:animate-card-flip', TEAM_TINT[t], streak && 'border-q-orange/70 shadow-[0_0_28px_-8px_rgba(255,107,53,0.8)]')}
              style={{ animationDelay: `${delay}s` }}
              data-testid={`result-team-${t}`}
            >
              {streak && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-linear-to-l from-q-orange to-q-gold px-2.5 py-0.5 text-[11px] font-black whitespace-nowrap text-black motion-safe:animate-streak">
                  🔥 دبل! ٣ صح ورا بعض
                </div>
              )}
              <div className="mb-1 truncate text-[11px] text-white/50">{teamName(view, t)}</div>
              <div className="mb-0.5 text-base">{info.icon}</div>
              <div className="mb-1 text-[11px] text-white/80">{info.full}</div>
              <div className="mb-1 truncate text-[11px] text-white/60">{stole ? '—' : ans >= 0 ? `جواب: ${q.options[ans]}` : 'لم يجب'}</div>
              <div className={cn('text-2xl font-black tabular-nums', d > 0 ? 'text-q-gold' : d < 0 ? 'text-q-red' : 'text-white/50')}>
                <bdi dir="ltr">
                  <CountUp to={d} delay={(delay + 0.3) * 1000} ms={800} />
                </bdi>{' '}
                نقطة
              </div>
              <div className="mt-1 border-t border-white/10 pt-1 text-[11px] text-white/60">
                المجموع{' '}
                <bdi dir="ltr" className="font-black text-white tabular-nums">
                  <CountUp from={total - d} to={total} delay={(delay + 0.5) * 1000} ms={900} signed={false} />
                </bdi>
              </div>
            </div>
          );
        })}
      </div>
      {mayAdvance ? (
        <button type="button" className="q-btn-gold" onClick={next} disabled={busy}>
          {lastRound ? 'النتيجة النهائية 🏆' : 'التالي ←'}
        </button>
      ) : (
        <div className="text-xs text-white/50">
          <WaitDots /> {view.mode === 'tv' ? 'التلفاز ينتقل للسؤال التالي...' : 'في انتظار الانتقال...'}
        </div>
      )}
    </Modal>
  );
}
