import type React from 'react';
import { tripleLines, toneClass } from './tripleText';
import { STREAM_ANSWER_MS, STREAM_CHOOSE_MS, displayName, standings, streamLabels, SYNC_CODE_RE, type StreamState, type SyncClientToServerEvents, type SyncServerToClientEvents, type SyncView } from '@quiz/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SoundToggle } from '@/game/fx/SoundToggle';
import { unlockAudio } from '@/game/fx/sound';
import { useStreamFx } from './useStreamFx';
import { io, type Socket } from 'socket.io-client';
import { QuestionImage } from '@/game/ui';
import { SERVER_URL, serverUrl } from '@/lib/server';
import { cn } from '@/lib/utils';
import { Background3D } from '@/game/fx/Background3D';
import { outcomeLabel } from './KickQuizPage';
import { CornerTools, useHotkeys, useWakeLock } from '@/lib/hotkeys';
import { LetterGrid, ListLive, ListResult, usedLetters } from './ListParts';
import { BoardGrid } from './BoardGrid';
import { HideBoxes } from './HideBoxes';
import { ShuffleBoxes } from './ShuffleBoxes';
import { AboutBadge, FaceGrid } from './PackParts';
import { Podium } from './Podium';
import { QuizHowToButton } from './QuizHowTo';
import { viewerSteps } from './QuizHowTo';
import './stream.css';

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
  // F = fullscreen (useful on a TV or a second screen); the screen stays on while it is open.
  useHotkeys();
  useWakeLock(true);
  // The fullscreen button only shows while the mouse moves, so an OBS capture never shows it.
  const [mouse, setMouse] = useState(false);
  useEffect(() => {
    if (!mouse) return;
    const t = setTimeout(() => setMouse(false), 2500);
    return () => clearTimeout(t);
  }, [mouse]);

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
  const swappers = r ? Object.values(r.choices).filter((c) => c === 'swap' || c === 'reverse').length : 0;
  const answerers = r ? Object.values(r.choices).filter((c) => c === 'answer').length : 0;
  const answered = r ? Object.keys(r.picks).length : 0;

  return (
    <div className="min-h-dvh bg-q-bg p-4 font-sans text-white relative isolate" dir="rtl" onPointerDown={unlockAudio} onPointerMove={() => !mouse && setMouse(true)}>
      <Background3D />
      <CornerTools className={cn('fixed top-3 left-3 z-40 transition-opacity duration-500', mouse ? 'opacity-100' : 'pointer-events-none opacity-0')} />
      <SoundToggle />
      {/* Fastest right answer of the round flies across the screen. */}
      {state.phase === 'result' && state.result?.fastest && (
        <div key={`fast-${state.used.length}`} className="pointer-events-none fixed inset-x-0 top-1/3 z-30 flex justify-center motion-safe:animate-fly-across" style={{ animationDelay: '0.6s' }}>
          <div className="rounded-2xl border-2 border-q-gold bg-q-bg/90 px-6 py-3 text-center shadow-[0_0_40px_-6px_rgba(247,201,72,0.8)]">
            <div className="text-sm font-black text-q-gold">{state.variant === 'list' ? '🏆 أكثر واحد عدّ' : '⚡ أسرع جواب صح'}</div>
            <div className="text-3xl font-black">{displayName(state, state.result.fastest)}</div>
          </div>
        </div>
      )}
      {/* «نقاطي» from the chat: that player's score and rank. */}
      {state.phase !== 'lobby' && <AppQr />}
      {state.scoreAsk && (
        <ScoreCard key={state.scoreAsk.at} state={state} who={state.scoreAsk.key} />
      )}
      <div className="kq-hud mx-auto mb-3 max-w-6xl ms-12 md:ms-auto 2xl:max-w-[110rem]">
        <span className="kq-live"><i />مباشر</span>
        <div className="whitespace-nowrap text-base font-black sm:text-lg 2xl:text-2xl">
          {state.variant === 'list' ? (
            <span className="text-q-gold">⏱️ عدّها</span>
          ) : (
            <>
              <span className="text-q-purple">جاوب</span> <span className="text-white/70">أو</span> <span className="text-q-cyan">{L.verb}</span>
            </>
          )}
        </div>
        <div className="hidden min-w-0 flex-1 items-center gap-2 sm:flex">
          <span className="shrink-0 text-xs font-black tabular-nums text-white/60 2xl:text-sm">
            {state.variant === 'hide' ? 'الجولة' : 'السؤال'} {state.used.length}/{state.pack?.total ?? state.totalCells}
          </span>
          <div className="kq-progress flex-1">
            <span style={{ width: `${Math.min(100, (state.used.length / Math.max(1, state.pack?.total ?? state.totalCells)) * 100)}%` }} />
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-q-cyan/15 px-3 py-1 text-sm font-black text-q-cyan">
          👥 <span key={state.joined.length} className="kq-count tabular-nums">{state.joined.length}</span>
        </span>
        <QuizHowToButton pack={Boolean(state.pack)} variant={state.phase === 'lobby' ? undefined : (state.variant ?? 'swap')} />
      </div>
      <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[1fr_18rem] xl:grid-cols-[1fr_20rem] 2xl:max-w-[110rem] 2xl:grid-cols-[1fr_26rem] 2xl:gap-6">
        <div className="kq-stage 2xl:text-[1.15em]">
          <div key={`${state.phase}-${state.used.length}`} className="kq-sweep" />
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

          {state.phase === 'board' && state.variant === 'list' && (
            <div className="py-8 text-center">
              <div className="mb-2 text-6xl">⏱️</div>
              <div className="text-4xl font-black text-q-gold">عدّها!</div>
              <div className="mt-2 text-xl">
                السؤال {state.used.length + 1} من {state.totalCells} — جهّزوا أصابعكم!
              </div>
              <div className="mx-auto mt-4 max-w-xl rounded-xl bg-q-panel p-4 text-lg">
                يطلع سؤال، واكتبوا أكبر عدد من الأجوبة في {Math.round((state.answerMs ?? 30000) / 1000)} ثانية
                <div className="mt-1 text-base text-white/70">كل جواب صح نقطة · وآخر الوقت: الأول ياخذ 5 نقاط زيادة، والثاني 3، والثالث نقطتين</div>
              </div>
              <div className="mt-3 text-white/60">
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

          {state.phase === 'board' && state.variant !== 'hide' && state.variant !== 'list' && !state.pack && (
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
              <div className="mb-2 text-5xl motion-safe:animate-pop-in">🎮</div>
              <div className="kq-q text-3xl font-black text-q-gold 2xl:text-5xl">{L.title}</div>
              <div className="mt-5 kq-join text-xl 2xl:text-3xl">اكتبوا <b className="text-[#53fc18]">دخول</b> في الشات عشان تلعبون</div>
              <div className="mt-4 text-white/60">
                المشاركون: <b key={state.joined.length} className="kq-count text-2xl tabular-nums text-q-cyan">{state.joined.length}</b> · الأسئلة: {state.used.length}/{state.totalCells}
              </div>
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-white/50">الستريمر يجهّز اللعبة <span className="kq-dots text-q-gold"><i /><i /><i /></span></div>
              {state.used.length === 0 && (
                <ol className="mx-auto mt-6 grid max-w-2xl gap-2 text-start sm:grid-cols-2">
                  {viewerSteps(state.variant).map((st, i) => (
                    <li key={i} className="kq-pick flex gap-2 p-3" style={{ '--i': i } as React.CSSProperties}>
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
              <div className="mb-2 text-5xl motion-safe:animate-bounce">🎙️</div>
              <div className="kq-q flex items-center justify-center gap-3 text-3xl font-black 2xl:text-5xl">الستريمر يختار جوابه <span className="kq-dots text-q-gold"><i /><i /><i /></span></div>
              <div className="mt-2 text-white/60">جهزوا أنفسكم، السؤال جاي لكم</div>
            </div>
          )}

          {state.phase === 'choose' && q && (
            <div className="py-2 text-center">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="kq-tag">{q.points} نقطة{q.categoryName ? ` · ${q.categoryName}` : ''}</span>
                {left !== null && <TimerRing left={left} total={Math.round(STREAM_CHOOSE_MS / 1000)} />}
              </div>
              <QuestionImage url={q.imageUrl} type={q.type ?? 'text'} large />
              <AboutBadge q={q} big />
              <div key={q.text} className="kq-q mb-5 text-3xl font-black leading-snug 2xl:text-5xl">{q.text}</div>
              {q.faces && <div className="mb-3 text-lg font-black text-q-cyan">🎭 الجواب واحد من الفريق — الصور تطلع بعد الاختيار</div>}
              <div className={cn('mx-auto mb-3 grid max-w-3xl gap-3', state.variant === 'triple' ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
                {[
                  { k: '1', label: 'جاوب', c: '#f7c948', n: answerers },
                  { k: '2', label: L.withStreamer, c: '#38bdf8', n: state.variant === 'triple' ? r ? Object.values(r.choices).filter((c) => c === 'swap').length : 0 : swappers },
                  ...(state.variant === 'triple' ? [{ k: '3', label: 'اعكس على الستريمر', c: '#a855f7', n: r ? Object.values(r.choices).filter((c) => c === 'reverse').length : 0 }] : []),
                ].map((t, i, all) => {
                  const total = Math.max(1, all.reduce((a, b) => a + b.n, 0));
                  return (
                    <div key={t.k} className="kq-pick text-start" style={{ '--c': t.c, '--i': i } as React.CSSProperties}>
                      <div className="flex items-center gap-3">
                        <b className="key">{t.k}</b>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-white/60">اكتبوا {t.k}</div>
                          <div className="truncate text-2xl font-black 2xl:text-3xl">{t.label}</div>
                        </div>
                        <b key={t.n} className="kq-count text-3xl tabular-nums" style={{ color: t.c }}>{t.n}</b>
                      </div>
                      <div className="kq-bar mt-3"><span style={{ width: `${(t.n / total) * 100}%` }} /></div>
                    </div>
                  );
                })}
              </div>
              <div className="text-sm text-white/70">✅ جاوب: {answerers} · {L.icon} {L.verb}: {swappers}</div>
            </div>
          )}

          {(state.phase === 'answer' || state.phase === 'result' || state.phase === 'steal') && q && r && (
            <div>
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="kq-tag">{state.variant === 'list' ? 'كل جواب صح نقطة' : `${q.points} نقطة`}{q.categoryName ? ` · ${q.categoryName}` : ''}</span>
                {state.phase === 'answer' && left !== null && <TimerRing left={left} total={Math.round((state.answerMs ?? STREAM_ANSWER_MS) / 1000)} big={state.variant === 'list'} />}
              </div>
              {state.variant === 'list' ? (
                <div>
                  {q.listLetter && (
                    <div className="mb-4">
                      <LetterGrid active={q.listLetter} used={usedLetters(state.used)} />
                    </div>
                  )}
                  <div key={q.text} className="kq-q mb-4 text-center text-4xl font-black leading-snug 2xl:text-6xl">{q.text}</div>
                  {state.phase === 'answer' ? <ListLive state={state} big /> : <ListResult state={state} big />}
                  {state.phase === 'answer' && <div className="mt-3 text-center text-base text-white/70">اكتبوا الأجوبة في الشات — تقدر تكتب أكثر من جواب بينها فاصلة «،»</div>}
                </div>
              ) : state.variant === 'hide' ? (
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
                <div key={q.text} className="kq-q mb-5 text-center text-3xl font-black leading-snug 2xl:text-5xl">{q.text}</div>
                {q.faces ? (
                  <FaceGrid q={q} answerAt={r.answerAt} now={now - offset} correct={result ? result.correctIndex : null} big />
                ) : (
                <div className="grid gap-3 sm:grid-cols-2 2xl:gap-4" style={{ perspective: '900px' }}>
                  {q.options.map((o, i) => (
                    <div key={`${q.text}-${i}`} style={{ '--i': i } as React.CSSProperties} className={cn('kq-opt text-xl 2xl:text-3xl', result && (i === result.correctIndex ? 'right' : 'dim'))}>
                      <span className="n">{i + 1}</span>
                      <span className="min-w-0 flex-1">{o}</span>
                      {result && i === result.correctIndex && <span className="kq-verdict text-2xl">✅</span>}
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
              {result && state.variant === 'triple' && (
                <div className="mt-4 space-y-1 text-center">
                  {tripleLines(state, false).map((l, i) => (
                    <div key={i} className={cn(i === 0 ? 'text-xl font-black' : 'text-lg font-bold', toneClass[l.tone])}>{l.text}</div>
                  ))}
                </div>
              )}
              {result && (state.variant === 'swap' || state.variant === 'flip' || !state.variant) && result.rows[state.streamer]?.outcome === 'mutual' && (
                <div className="mt-4 text-center text-2xl font-black text-q-gold">🤝 الستريمر و{displayName(state, result.streamerPartner ?? '')} اختاروا بعض — الاثنين صفر</div>
              )}
              {result && state.variant !== 'hide' && state.variant !== 'triple' && state.variant !== 'list' && result.rows[state.streamer]?.outcome !== 'mutual' && (
                <div className="mt-4 text-center text-xl font-black">
                  {result.streamerChoice === 'swap' ? `الستريمر ${L.did} ${state.variant === 'flip' ? 'على' : 'مع'} ${displayName(state, result.streamerPartner ?? '')}` : swappers > 0 && state.variant === 'flip' ? `الشات قلب على الستريمر (${swappers})` : 'الستريمر جاوب'} —{' '}
                  <span className={cn('kq-verdict inline-block', result.streamerCorrect ? 'text-q-green' : 'text-q-red')}>{result.streamerPick === null ? 'بدون جواب' : result.streamerCorrect ? 'صح ✅' : 'غلط ❌'}</span>
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
          <div className="kq-side">
            <div className="mb-3 flex items-center gap-2 text-lg font-black text-q-gold 2xl:text-2xl">🏆 {state.phase === 'result' ? 'أفضل 10 بعد هذا السؤال' : 'أفضل 10'}</div>
            {rows.length === 0 && <p className="text-xs text-white/50">الترتيب يطلع أول ما يبدأ السؤال الأول</p>}
            <ol className="space-y-1.5 text-base 2xl:text-xl">
              {rows.map((row, i) => {
                const o = state.phase === 'result' && row.outcome ? outcomeLabel(state.variant, row.outcome) : null;
                return (
                  <li key={row.key} style={{ '--i': i } as React.CSSProperties} className={cn('kq-row', i < 3 && `r${i + 1}`, state.phase === 'result' && row.delta > 0 && 'up')}>
                    <span className="rank">{i + 1}</span>
                    <span className="truncate font-bold">{row.name}{row.streamer ? ' 🎙️' : ''}{row.run > 0 && <span className="ms-1 text-[10px]" title="إجابات صح ورا بعض">{'🔥'.repeat(row.run)}</span>}</span>
                    <bdi dir="ltr" key={row.score} className="kq-count font-black tabular-nums text-q-gold">{row.score}</bdi>
                    {o && state.variant === 'list' && (
                      <div className="kq-delta col-span-3 col-start-2 text-xs text-q-green">
                        ✍️ {state.result?.rows[row.key]?.found ?? 0} جواب{state.result?.rows[row.key]?.bonus ? <b className="text-q-gold"> + بونص {state.result.rows[row.key]!.bonus}</b> : null} <bdi dir="ltr">+{row.delta}</bdi>
                      </div>
                    )}
                    {o && state.variant !== 'list' && (
                      <div className={cn('kq-delta col-span-2 col-start-2 text-xs', o.cls)}>
                        {o.label}{row.streak && <b className="text-q-orange"> 🔥 دبل</b>}{row.first && <b className="text-q-gold"> ⚡ أول واحد — دبل</b>} <bdi dir="ltr">{row.delta > 0 ? `+${row.delta}` : row.delta}</bdi>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
          <div className="kq-side">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-lg font-black text-q-cyan">👥 المشاركون</span>
              <span className="rounded-full bg-q-cyan/15 px-2 py-0.5 text-xs font-black text-q-cyan">{state.joined.length}</span>
            </div>
            {state.joined.length === 0 ? (
              <p className="text-xs text-white/50">اكتبوا «دخول» في الشات عشان تشاركون</p>
            ) : (
              <div className="flex max-h-64 flex-wrap gap-1.5 overflow-auto">
                {state.joined.map((k) => (
                  <span key={k} className="kq-chip rounded-lg border border-q-line bg-q-panel px-2 py-1 text-xs font-black 2xl:text-sm">
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
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-30 -translate-x-1/2 motion-safe:animate-toast-in">
      <div className="flex items-center gap-4 rounded-2xl border-2 border-q-cyan/60 bg-q-bg/90 px-7 py-4 shadow-[0_0_40px_-8px_rgba(56,189,248,0.85)]">
        <span className="text-4xl">📊</span>
        <div>
          <div className="text-2xl font-black">{me.name}</div>
          <div className="text-xl text-white/75">
            <bdi dir="ltr" className="text-2xl font-black text-q-gold">{me.score}</bdi> نقطة · المركز <b className="text-2xl text-q-cyan">{rank}</b> من {all.length}
            {me.run > 0 && <span className="ms-2">{'🔥'.repeat(me.run)}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The App Store QR in the corner once the game is on: viewers can grab the app from the stream. */
function AppQr() {
  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-20 hidden flex-col lg:flex items-center gap-1.5 rounded-2xl border border-white/15 bg-q-bg/85 p-3.5 shadow-lg backdrop-blur">
      <img src={serverUrl('/app-qr.svg')} alt="" className="size-42 rounded-lg bg-white p-2" />
      <div className="text-base font-black text-white/85">📱 حمّل اللعبة</div>
      <div className="text-sm font-bold text-white/50">App Store</div>
    </div>
  );
}

/** A ring that empties with the time; it turns red and pulses for the last five seconds. */
function TimerRing({ left, total, big }: { left: number; total: number; big?: boolean }) {
  const size = big ? 96 : 72;
  const rr = size / 2 - 6;
  const c = 2 * Math.PI * rr;
  const frac = Math.max(0, Math.min(1, left / Math.max(1, total)));
  const urgent = left <= 5;
  const color = urgent ? '#f43f5e' : left <= total / 2 ? '#f7c948' : '#38bdf8';
  return (
    <div className={cn('kq-timer shrink-0', urgent && left > 0 && 'urgent')} style={{ width: size, height: size, color }}>
      <svg width={size} height={size}>
        <circle className="track" cx={size / 2} cy={size / 2} r={rr} fill="none" strokeWidth="6" />
        <circle className="run" cx={size / 2} cy={size / 2} r={rr} fill="none" strokeWidth="6" stroke={color} strokeDasharray={c} strokeDashoffset={c * (1 - frac)} />
      </svg>
      <span className={cn('font-black tabular-nums', big ? 'text-4xl' : 'text-3xl')}>{left}</span>
    </div>
  );
}
