import { displayName, standings, streamLabels, SYNC_CODE_RE, type StreamState, type SyncClientToServerEvents, type SyncServerToClientEvents, type SyncView } from '@quiz/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SoundToggle } from '@/game/fx/SoundToggle';
import { unlockAudio } from '@/game/fx/sound';
import { useStreamFx } from './useStreamFx';
import { io, type Socket } from 'socket.io-client';
import { QuestionImage } from '@/game/ui';
import { SERVER_URL } from '@/lib/server';
import { cn } from '@/lib/utils';
import { Background3D } from '@/game/fx/Background3D';
import { outcomeLabel } from './KickQuizPage';
import { BoardGrid } from './BoardGrid';
import { HideBoxes } from './HideBoxes';
import { ShuffleBoxes } from './ShuffleBoxes';
import { AboutBadge, FaceGrid } from './PackParts';
import { Podium } from './Podium';
import { QuizHowToButton } from './QuizHowTo';
import { VIEWER_STEPS } from './QuizHowTo';

/** The page to broadcast: shows the game that the streamer runs from his private control page, never his secret choice. */
export function KickQuizScreen() {
  const code = new URLSearchParams(window.location.search).get('code') ?? '';
  const [view, setView] = useState<SyncView | null>(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [hosted, setHosted] = useState(true);
  const sockRef = useRef<Socket<SyncServerToClientEvents, SyncClientToServerEvents> | null>(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (!SYNC_CODE_RE.test(code)) return setError('الرابط ناقص الكود — انسخه من صفحة التحكم');
    const sock: Socket<SyncServerToClientEvents, SyncClientToServerEvents> = io(`${SERVER_URL}/kick-sync`);
    sockRef.current = sock;
    sock.on('disconnect', () => setConnected(false));
    sock.on('connect', () => {
      setConnected(true);
      sock.emit('sync:watch', code, (res) => {
        if (!res.ok) setError(res.error ?? 'تعذّر الاتصال');
        else setHosted(Boolean(res.hosted));
      });
    });
    sock.on('sync:view', (v) => {
      setHosted(true);
      setPicking(false);
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
  const hostNow = useCallback(() => Date.now() - offset, [offset]);
  const secondsLeft = state?.deadline ? Math.max(0, Math.ceil((state.deadline - (now - offset)) / 1000)) : null;
  useStreamFx(state, state?.phase === 'choose' || state?.phase === 'answer' ? secondsLeft : null);

  if (!state) {
    return (
      <div className="grid min-h-dvh place-items-center bg-q-bg p-6 text-center font-sans text-white relative isolate" dir="rtl">
        <Background3D />
        <div>
          <div className="mb-2 text-4xl">🎮</div>
          <div className="text-xl font-black text-q-gold">جاوب أو بادل</div>
          <QuizHowToButton className="mt-3" />
          <div className="mt-2 text-sm text-white/60">{error || (hosted ? 'بانتظار الستريمر يبدأ اللعبة...' : 'ما فيه صفحة تحكم بهذا الكود — انسخ الرابط من جديد من صفحة التحكم')}</div>
          <div className="mt-4 text-[11px] text-white/30">{connected ? 'متصل بالسيرفر' : 'جاري الاتصال بالسيرفر...'} · الكود: <bdi dir="ltr">{code}</bdi></div>
        </div>
      </div>
    );
  }

  const L = streamLabels(state.variant);
  const rows = standings(state).slice(0, 10);
  const r = state.round;
  const q = r?.question;
  const result = state.result;
  const left = state.deadline ? Math.max(0, Math.ceil((state.deadline - (now - offset)) / 1000)) : null;
  const swappers = r ? Object.values(r.choices).filter((c) => c === 'swap').length : 0;
  const answerers = r ? Object.values(r.choices).filter((c) => c === 'answer').length : 0;
  const answered = r ? Object.keys(r.picks).length : 0;

  return (
    <div className="min-h-dvh bg-q-bg p-4 font-sans text-white relative isolate" dir="rtl" onPointerDown={unlockAudio}>
      <Background3D />
      <SoundToggle />
      {/* Fastest right answer of the round flies across the screen. */}
      {state.phase === 'result' && state.result?.fastest && (
        <div key={`fast-${state.used.length}`} className="pointer-events-none fixed inset-x-0 top-1/3 z-30 flex justify-center motion-safe:animate-fly-across" style={{ animationDelay: '0.6s' }}>
          <div className="rounded-2xl border-2 border-q-gold bg-q-bg/90 px-6 py-3 text-center shadow-[0_0_40px_-6px_rgba(247,201,72,0.8)]">
            <div className="text-sm font-black text-q-gold">⚡ أسرع جواب صح</div>
            <div className="text-3xl font-black">{displayName(state, state.result.fastest)}</div>
          </div>
        </div>
      )}
      {/* «نقاطي» from the chat: that player's score and rank. */}
      {state.scoreAsk && (
        <ScoreCard key={state.scoreAsk.at} state={state} who={state.scoreAsk.key} />
      )}
      <div className="mx-auto mb-3 flex max-w-6xl items-center justify-between ps-12">
        <div className="text-lg font-black">
          <span className="text-q-purple">جاوب</span> <span className="text-white/70">أو</span> <span className="text-q-cyan">{L.verb}</span>
        </div>
        <QuizHowToButton variant={state.phase === 'lobby' ? undefined : (state.variant ?? 'swap')} />
      </div>
      <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-[1fr_18rem]">
        <div className="q-card">
          {state.phase === 'board' && state.variant === 'hide' && (
            <div className="py-8 text-center">
              <div className="mb-2 text-6xl">📦</div>
              <div className="text-3xl font-black text-q-gold">خبّي أو اكشف</div>
              <div className="mt-2 text-xl">
                الجولة {state.used.length + 1} من {state.totalCells} — جهّزوا أنفسكم!
              </div>
              <div className="mt-2 text-white/60">
                اكتبوا <b className="text-q-gold">دخول</b> للمشاركة · المشاركون {state.joined.length}
              </div>
            </div>
          )}

          {state.phase === 'board' && state.pack && (
            <div className="py-8 text-center">
              {state.pack.logo ? <img src={state.pack.logo} alt={state.pack.name} className="mx-auto mb-3 size-36 rounded-3xl object-cover shadow-[0_0_40px_rgba(255,20,50,0.45)]" /> : <div className="mb-2 text-6xl">🎭</div>}
              <div className="text-3xl font-black text-q-gold">{state.pack.name}</div>
              <div className="mt-2 text-xl">
                السؤال {state.used.length + 1} من {state.pack.total} — جهّزوا أنفسكم!
              </div>
              <div className="mt-2 text-white/60">
                اكتبوا <b className="text-q-gold">دخول</b> للمشاركة · المشاركون {state.joined.length}
              </div>
            </div>
          )}

          {state.phase === 'board' && state.variant !== 'hide' && !state.pack && (
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-black">{picking ? 'جاري فتح السؤال...' : '🎯 اختر سؤال من اللوحة'}</span>
                <span className="text-white/60">
                  اكتبوا <b className="text-q-gold">دخول</b> للمشاركة · المشاركون {state.joined.length} · الأسئلة {state.used.length}/{state.totalCells}
                </span>
              </div>
              <BoardGrid
                board={state.board ?? []}
                used={state.used}
                big
                disabled={picking}
                onPick={(category, points) => {
                  setPicking(true);
                  sockRef.current?.emit('sync:pick', { code, category, points }, (res) => {
                    if (!res.ok) setPicking(false);
                  });
                  // If the control page never answers (closed or offline), let the streamer try again.
                  setTimeout(() => setPicking(false), 8000);
                }}
              />
            </div>
          )}

          {state.phase === 'lobby' && (
            <div className="py-10 text-center">
              <div className="mb-2 text-5xl">🎮</div>
              <div className="text-3xl font-black text-q-gold">{L.title}</div>
              <div className="mt-3 text-xl">اكتبوا <b className="text-q-gold">دخول</b> في الشات عشان تلعبون</div>
              <div className="mt-2 text-white/60">المشاركون: {state.joined.length} · الأسئلة: {state.used.length}/{state.totalCells}</div>
              <div className="mt-4 text-sm text-white/50">الستريمر يجهّز اللعبة...</div>
              {state.used.length === 0 && (
                <ol className="mx-auto mt-6 grid max-w-2xl gap-2 text-start sm:grid-cols-2">
                  {VIEWER_STEPS.map((st, i) => (
                    <li key={i} className="flex gap-2 rounded-xl border border-q-line bg-q-panel p-3">
                      <span className="text-xl">{st.icon}</span>
                      <div>
                        <div className="text-sm font-black">{st.title}</div>
                        <div className="text-xs leading-relaxed text-white/70">{st.text}</div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {state.phase === 'streamer' && q && state.variant === 'hide' && (
            <div className="py-6 text-center">
              <div className="mb-2 inline-block rounded-full bg-q-gold/15 px-3 py-1 font-black text-q-gold">{q.points} نقطة · {q.categoryName}</div>
              <div className="mb-5 text-3xl font-black">🔑 الستريمر يحط المفتاح… ركّزوا!</div>
              <HideBoxes big />
            </div>
          )}

          {state.phase === 'shuffle' && q && r?.shuffle && (
            <div className="py-2 text-center">
              <div className="mb-2 inline-block rounded-full bg-q-gold/15 px-3 py-1 font-black text-q-gold">{q.points} نقطة · {q.categoryName}</div>
              <div className="mb-4 text-3xl font-black">👀 تابعوا المفتاح!</div>
              <ShuffleBoxes shuffle={r.shuffle} startAt={r.shuffleAt ?? 0} hostNow={hostNow} big />
            </div>
          )}

          {state.phase === 'streamer' && q && state.variant !== 'hide' && (
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
              <AboutBadge q={q} big />
              <div className="mb-4 text-3xl font-black leading-snug">{q.text}</div>
              {q.faces && <div className="mb-3 text-lg font-black text-q-cyan">🎭 الجواب واحد من الفريق — الصور تطلع بعد الاختيار</div>}
              <div className="mx-auto mb-3 max-w-md space-y-1 rounded-xl bg-q-panel p-4 text-2xl">
                <div>اكتبوا <b className="text-q-gold">1</b> = جاوب</div>
                <div>اكتبوا <b className="text-q-cyan">2</b> = {L.withStreamer}</div>
              </div>
              <div className="text-sm text-white/70">✅ جاوب: {answerers} · {L.icon} {L.verb}: {swappers}</div>
              {left !== null && <div className="mt-2 text-4xl font-black tabular-nums text-q-cyan">⏱ {left}</div>}
            </div>
          )}

          {(state.phase === 'answer' || state.phase === 'result' || state.phase === 'steal') && q && r && (
            <div>
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="rounded-full bg-q-gold/15 px-3 py-1 font-black text-q-gold">{q.points} نقطة{q.categoryName ? ` · ${q.categoryName}` : ''}</span>
                {state.phase === 'answer' && left !== null && <span className="text-2xl font-black tabular-nums text-q-cyan">⏱ {left}</span>}
              </div>
              {state.variant === 'hide' ? (
                <div>
                  <div className="mb-4 text-center text-3xl font-black">{result ? '🔑 هنا كان المفتاح!' : '🔎 وين المفتاح؟ اكتبوا رقم الصندوق (1-10)'}</div>
                  {r.shuffle ? (
                    <ShuffleBoxes shuffle={r.shuffle} startAt={r.shuffleAt ?? 0} hostNow={hostNow} reveal={Boolean(result)} big />
                  ) : (
                    <HideBoxes keyAt={result ? result.correctIndex : null} revealed={Boolean(result)} big />
                  )}
                  {state.phase === 'answer' && <div className="mt-3 text-center text-sm text-white/70">خمّن {answered} · أول رقم تكتبه هو اللي ينحسب</div>}
                </div>
              ) : (
                <>
                <QuestionImage url={result && q.revealUrl ? q.revealUrl : q.imageUrl} type={q.type ?? 'text'} revealed={Boolean(result)} large />
                <AboutBadge q={q} big />
                <div className="mb-4 text-center text-3xl font-black leading-snug">{q.text}</div>
                {q.faces ? (
                  <FaceGrid q={q} answerAt={r.answerAt} now={now - offset} correct={result ? result.correctIndex : null} big />
                ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {q.options.map((o, i) => (
                    <div key={i} className={cn('flex items-center gap-2 rounded-xl border-2 p-4 text-start text-xl font-black', result && i === result.correctIndex ? 'border-q-green bg-q-green/15' : 'border-q-line bg-q-panel')}>
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-q-gold/15 text-q-gold">{i + 1}</span>
                      {o}
                    </div>
                  ))}
                </div>
                )}
                {state.phase === 'answer' && <div className="mt-3 text-center text-sm text-white/70">اكتبوا رقم {q.faces ? 'الشخص (1-8)' : 'الخيار (1-4)'} · أجاب {answered} · {L.verb} {swappers}</div>}
                </>
              )}
              {state.phase === 'steal' && (
                <div className="mt-4 text-center text-2xl font-black text-q-red motion-safe:animate-streak">💸 ما أحد لقاه… الستريمر بيختار واحد ياخذ كل نقاطه!</div>
              )}
              {result && state.phase === 'result' && state.variant === 'hide' && (
                <div className={cn('mt-4 text-center text-2xl font-black', result.streamerCorrect ? 'text-q-red' : 'text-q-green')}>
                  {result.stolen
                    ? `💸 الستريمر أخذ ${result.stolen.points} نقطة من ${displayName(state, result.stolen.from)}!`
                    : result.streamerCorrect
                    ? '🔒 ما أحد لقاه — النقاط للستريمر'
                    : `🔓 لقاه ${Object.values(result.rows).filter((x) => x.outcome === 'answer-right').length} من الشات!`}
                </div>
              )}
              {result && state.variant !== 'hide' && (
                <div className="mt-4 text-center text-xl font-black">
                  {result.streamerChoice === 'swap' ? `الستريمر ${L.did} ${state.variant === 'flip' ? 'على' : 'مع'} ${displayName(state, result.streamerPartner ?? '')}` : swappers > 0 && state.variant === 'flip' ? `الشات قلب على الستريمر (${swappers})` : 'الستريمر جاوب'} —{' '}
                  <span className={result.streamerCorrect ? 'text-q-green' : 'text-q-red'}>{result.streamerPick === null ? 'بدون جواب' : result.streamerCorrect ? 'صح ✅' : 'غلط ❌'}</span>
                  {state.variant !== 'flip' && result.streamerCorrect && (result.streamerChoice === 'swap' || swappers > 0) && (
                    <div className="mt-1 text-lg text-q-gold motion-safe:animate-streak">
                      😵 {result.streamerChoice === 'swap' ? `${displayName(state, result.streamerPartner ?? '')} انزرف! الستريمر أخذ جوابه ودبل النقاط` : `الستريمر انزرف! ${swappers} بادلوا معه وأخذوا دبل النقاط`}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {state.phase === 'over' && (
            <div className="py-6">
              <Podium rows={rows} big />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="q-card">
            <div className="mb-2 text-lg font-black text-q-gold">{state.phase === 'result' ? 'أفضل 10 بعد هذا السؤال' : 'أفضل 10'}</div>
            <ol className="space-y-2 text-base">
              {rows.map((row, i) => {
                const o = state.phase === 'result' && row.outcome ? outcomeLabel(state.variant, row.outcome) : null;
                return (
                  <li key={row.key}>
                    <div className="flex justify-between gap-2">
                      <span className="truncate">{i + 1}. {row.name}{row.streamer ? ' 🎙️' : ''}{row.run > 0 && <span className="ms-1 text-[10px]" title="إجابات صح ورا بعض">{'🔥'.repeat(row.run)}</span>}</span>
                      <bdi dir="ltr" className="font-black tabular-nums">{row.score}</bdi>
                    </div>
                    {o && (
                      <div className={cn('text-xs', o.cls)}>
                        {o.label}{row.streak && <b className="text-q-orange"> 🔥 دبل</b>}{row.first && <b className="text-q-gold"> ⚡ أول واحد — دبل</b>} <bdi dir="ltr">{row.delta > 0 ? `+${row.delta}` : row.delta}</bdi>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
          <div className="q-card">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-lg font-black text-q-cyan">👥 المشاركون</span>
              <span className="rounded-full bg-q-cyan/15 px-2 py-0.5 text-xs font-black text-q-cyan">{state.joined.length}</span>
            </div>
            {state.joined.length === 0 ? (
              <p className="text-xs text-white/50">اكتبوا «دخول» في الشات عشان تشاركون</p>
            ) : (
              <div className="flex max-h-64 flex-wrap gap-1.5 overflow-auto">
                {state.joined.map((k) => (
                  <span key={k} className="rounded-lg border border-q-line bg-q-panel px-2 py-1 text-xs font-black">
                    {state.names[k] ?? k}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


function ScoreCard({ state, who }: { state: StreamState; who: string }) {
  const all = standings(state);
  const rank = all.findIndex((r) => r.key === who) + 1;
  const me = all[rank - 1];
  if (!me) return null;
  return (
    <div className="pointer-events-none fixed bottom-8 left-1/2 z-30 -translate-x-1/2 motion-safe:animate-toast-in">
      <div className="flex items-center gap-5 rounded-3xl border-2 border-q-cyan/70 bg-q-bg/95 px-8 py-5 shadow-[0_0_50px_-6px_rgba(56,189,248,0.9)]">
        <span className="text-5xl">📊</span>
        <div>
          <div className="text-3xl font-black">{me.name}</div>
          <div className="mt-1 text-2xl font-bold text-white/85">
            <bdi dir="ltr" className="text-4xl font-black text-q-gold">{me.score}</bdi> نقطة · المركز <b className="text-3xl text-q-cyan">{rank}</b> من {all.length}
            {me.run > 0 && <span className="ms-2">{'🔥'.repeat(me.run)}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
