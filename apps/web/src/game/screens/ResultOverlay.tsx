import { canAdvance, POINTS, type RoomView } from '@quiz/shared';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { haptic } from '@/lib/native';
import { serverUrl } from '@/lib/server';
import { cn } from '@/lib/utils';
import { send } from '../connection';
import { actionLabel, Modal, TEAM_TINT, teamName, WaitDots } from '../ui';

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
  const bothSteal = r.actions[0] === 'steal' && r.actions[1] === 'steal';
  const icon = bothSteal ? lbl.icon + lbl.icon : r.deltas.some((d) => d >= 200) ? '🔥' : r.deltas.some((d) => d < 0) ? '💀' : '🎯';
  // Reveal/zoom questions have a second "answer" picture; blurred logos are shown sharp.
  const picture = r.revealUrl ?? (q.type === 'image' ? q.imageUrl : null);
  const mayAdvance = canAdvance(view.mode, view.you);
  const lastRound = view.used.length >= view.categories.length * POINTS.length;

  async function next() {
    setBusy(true);
    const res = await send('game:next');
    setBusy(false);
    if (!res.ok) toast.error(res.error);
  }

  return (
    <Modal open>
      <div className="mb-2 text-5xl">{icon}</div>
      <h2 className="mb-3 text-xl font-black">{bothSteal ? `كلاهم ${view.variant === 'flip' ? 'قلبا' : 'بادلا'} — لا نقاط!` : 'نتيجة الجولة'}</h2>
      {picture && <img src={serverUrl(picture)} alt="" className="mx-auto mb-3.5 block max-h-56 max-w-full rounded-xl" />}
      <div className="mb-3 rounded-lg bg-q-green/10 px-3 py-2 text-sm text-[#2ecc71]">
        ✅ الإجابة الصحيحة: <b>{q.options[r.correctIndex]}</b>
      </div>
      <div className="mb-3.5 grid grid-cols-2 gap-2.5">
        {([0, 1] as const).map((t) => {
          const stole = r.actions[t] === 'steal';
          const ans = r.answers[t];
          const d = r.deltas[t];
          return (
            <div key={t} className={cn('rounded-xl border px-2 py-3', TEAM_TINT[t])} data-testid={`result-team-${t}`}>
              <div className="mb-1 truncate text-[11px] text-white/50">{teamName(view, t)}</div>
              <div className="mb-0.5 text-base">{stole ? lbl.icon : '✅'}</div>
              <div className="mb-1 text-[11px] text-white/80">{stole ? lbl.full : 'إجابة'}</div>
              <div className="mb-1 truncate text-[11px] text-white/60">{stole ? '—' : ans >= 0 ? `جواب: ${q.options[ans]}` : 'لم يجب'}</div>
              <div className={cn('text-xl font-black tabular-nums', d > 0 ? 'text-q-gold' : d < 0 ? 'text-q-red' : 'text-white/50')}>
                <bdi dir="ltr">{d > 0 ? `+${d}` : d}</bdi> نقطة
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
