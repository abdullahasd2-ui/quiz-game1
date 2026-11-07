import { displayName, standings, SYNC_CODE_RE, type StreamState, type SyncClientToServerEvents, type SyncServerToClientEvents, type SyncView } from '@quiz/shared';
import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { QuestionImage } from '@/game/ui';
import { SERVER_URL } from '@/lib/server';
import { cn } from '@/lib/utils';
import { OUTCOME } from './KickQuizPage';

/** The page to broadcast: shows the game that the streamer runs from his private control page, never his secret choice. */
export function KickQuizScreen() {
  const code = new URLSearchParams(window.location.search).get('code') ?? '';
  const [view, setView] = useState<SyncView | null>(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!SYNC_CODE_RE.test(code)) return setError('الرابط ناقص الكود — انسخه من صفحة التحكم');
    const sock: Socket<SyncServerToClientEvents, SyncClientToServerEvents> = io(`${SERVER_URL}/kick-sync`);
    sock.on('disconnect', () => setConnected(false));
    sock.on('connect', () => {
      setConnected(true);
      sock.emit('sync:watch', code, (res) => !res.ok && setError(res.error ?? 'تعذّر الاتصال'));
    });
    sock.on('sync:view', (v) => {
      setView(v);
      setOffset(Date.now() - v.hostNow);
    });
    sock.on('connect_error', () => setError('تعذّر الاتصال بالسيرفر'));
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => {
      clearInterval(t);
      sock.disconnect();
    };
  }, [code]);

  const state: StreamState | null = view?.state ?? null;
  if (!state) {
    return (
      <div className="grid min-h-dvh place-items-center bg-q-bg p-6 text-center font-sans text-white" dir="rtl">
        <div>
          <div className="mb-2 text-4xl">🎮</div>
          <div className="text-xl font-black text-q-gold">جاوب أو بادل</div>
          <div className="mt-2 text-sm text-white/60">{error || 'بانتظار الستريمر يبدأ اللعبة...'}</div>
          <div className="mt-4 text-[11px] text-white/30">{connected ? 'متصل بالسيرفر' : 'جاري الاتصال بالسيرفر...'} · الكود: <bdi dir="ltr">{code}</bdi></div>
        </div>
      </div>
    );
  }

  const rows = standings(state).slice(0, 10);
  const r = state.round;
  const q = r?.question;
  const result = state.result;
  const left = state.deadline ? Math.max(0, Math.ceil((state.deadline - (now - offset)) / 1000)) : null;
  const swappers = r ? Object.values(r.choices).filter((c) => c === 'swap').length : 0;
  const answerers = r ? Object.values(r.choices).filter((c) => c === 'answer').length : 0;
  const answered = r ? Object.keys(r.picks).length : 0;

  return (
    <div className="min-h-dvh bg-q-bg p-4 font-sans text-white" dir="rtl">
      <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-[1fr_18rem]">
        <div className="q-card">
          {(state.phase === 'lobby' || state.phase === 'board') && (
            <div className="py-10 text-center">
              <div className="mb-2 text-5xl">🎮</div>
              <div className="text-3xl font-black text-q-gold">جاوب أو بادل</div>
              <div className="mt-3 text-xl">اكتبوا <b className="text-q-gold">دخول</b> في الشات عشان تلعبون</div>
              <div className="mt-2 text-white/60">المشاركون: {state.joined.length} · الأسئلة: {state.used.length}/{state.totalCells}</div>
              <div className="mt-4 text-sm text-white/50">الستريمر يختار السؤال التالي...</div>
            </div>
          )}

          {state.phase === 'streamer' && q && (
            <div className="py-10 text-center">
              <div className="mb-2 text-sm text-q-gold">{q.points} نقطة{q.categoryName ? ` · ${q.categoryName}` : ''}</div>
              <div className="mb-2 text-5xl">🎙️</div>
              <div className="text-3xl font-black">الستريمر يختار جوابه...</div>
              <div className="mt-2 text-white/60">جهزوا أنفسكم، السؤال جاي لكم</div>
            </div>
          )}

          {state.phase === 'choose' && q && (
            <div className="py-2 text-center">
              <div className="mb-1 text-sm text-q-gold">{q.points} نقطة{q.categoryName ? ` · ${q.categoryName}` : ''}</div>
              <QuestionImage url={q.imageUrl} type={q.type ?? 'text'} large />
              <div className="mb-4 text-3xl font-black leading-snug">{q.text}</div>
              <div className="mx-auto mb-3 max-w-md space-y-1 rounded-xl bg-q-panel p-4 text-2xl">
                <div>اكتبوا <b className="text-q-gold">1</b> = جاوب</div>
                <div>اكتبوا <b className="text-q-cyan">2</b> = بادل مع الستريمر</div>
              </div>
              <div className="text-sm text-white/70">✅ جاوب: {answerers} · 🔄 بادل: {swappers}</div>
              {left !== null && <div className="mt-2 text-4xl font-black tabular-nums text-q-cyan">⏱ {left}</div>}
            </div>
          )}

          {(state.phase === 'answer' || state.phase === 'result' || state.phase === 'over') && q && r && state.phase !== 'over' && (
            <div>
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="rounded-full bg-q-gold/15 px-3 py-1 font-black text-q-gold">{q.points} نقطة{q.categoryName ? ` · ${q.categoryName}` : ''}</span>
                {state.phase === 'answer' && left !== null && <span className="text-2xl font-black tabular-nums text-q-cyan">⏱ {left}</span>}
              </div>
              <QuestionImage url={result && q.revealUrl ? q.revealUrl : q.imageUrl} type={q.type ?? 'text'} revealed={Boolean(result)} large />
              <div className="mb-4 text-center text-3xl font-black leading-snug">{q.text}</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {q.options.map((o, i) => (
                  <div key={i} className={cn('flex items-center gap-2 rounded-xl border-2 p-4 text-start text-xl font-black', result && i === result.correctIndex ? 'border-q-green bg-q-green/15' : 'border-q-line bg-q-panel')}>
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-q-gold/15 text-q-gold">{i + 1}</span>
                    {o}
                  </div>
                ))}
              </div>
              {state.phase === 'answer' && <div className="mt-3 text-center text-sm text-white/70">اكتبوا رقم الخيار (1-4) · أجاب {answered} · بادل {swappers}</div>}
              {result && (
                <div className="mt-4 text-center text-xl font-black">
                  {result.streamerChoice === 'swap' ? `الستريمر بادل مع ${displayName(state, result.streamerPartner ?? '')}` : 'الستريمر جاوب'} —{' '}
                  <span className={result.streamerCorrect ? 'text-q-green' : 'text-q-red'}>{result.streamerPick === null ? 'بدون جواب' : result.streamerCorrect ? 'صح ✅' : 'غلط ❌'}</span>
                </div>
              )}
            </div>
          )}

          {state.phase === 'over' && (
            <div className="py-10 text-center">
              <div className="mb-2 text-5xl">🏆</div>
              <div className="text-4xl font-black text-q-gold">الفائز: {rows[0]?.name}</div>
              <div className="mt-1 text-white/60">{rows[0]?.score} نقطة</div>
            </div>
          )}
        </div>

        <div className="q-card">
          <div className="mb-2 text-lg font-black text-q-gold">{state.phase === 'result' ? 'أفضل 10 بعد هذا السؤال' : 'أفضل 10'}</div>
          <ol className="space-y-2 text-base">
            {rows.map((row, i) => {
              const o = state.phase === 'result' && row.outcome ? OUTCOME[row.outcome] : null;
              return (
                <li key={row.key}>
                  <div className="flex justify-between gap-2">
                    <span className="truncate">{i + 1}. {row.name}{row.streamer ? ' 🎙️' : ''}</span>
                    <bdi dir="ltr" className="font-black tabular-nums">{row.score}</bdi>
                  </div>
                  {o && (
                    <div className={cn('text-xs', o.cls)}>
                      {o.label} <bdi dir="ltr">{row.delta > 0 ? `+${row.delta}` : row.delta}</bdi>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}

