import {
  chatMessage,
  deal,
  displayName,
  KICK_CHANNEL_RE,
  newStream,
  standings,
  streamerAct,
  tick,
  type KickClientToServerEvents,
  type KickServerToClientEvents,
  type KickStatus,
  type StreamQuestion,
  type StreamState,
  type StreamerAct,
} from '@quiz/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { SERVER_URL } from '@/lib/server';
import { cn } from '@/lib/utils';

type KickSocket = Socket<KickServerToClientEvents, KickClientToServerEvents>;

async function fetchQuestion(): Promise<StreamQuestion> {
  const res = await fetch(`${SERVER_URL}/api/kick/question`);
  if (!res.ok) throw new Error('تعذّر جلب سؤال');
  return (await res.json()) as StreamQuestion;
}

/** «جاوب أو بادل» on a Kick stream: the streamer clicks, the chat types, everyone keeps their own score. */
export function KickQuizPage() {
  const params = new URLSearchParams(window.location.search);
  const [linked] = useState(params.get('linked') ?? '');
  const [canLink, setCanLink] = useState(false);
  const [channel, setChannel] = useState(params.get('linked') ?? '');
  const [rounds, setRounds] = useState(10);
  const [test, setTest] = useState(false);
  const [error, setError] = useState(params.get('kick_error') ?? '');
  const [state, setState] = useState<StreamState | null>(null);
  const [status, setStatus] = useState<KickStatus>({ state: 'connecting' });
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [fake, setFake] = useState('');
  const ref = useRef<StreamState | null>(null);

  const set = useCallback((s: StreamState) => {
    ref.current = s;
    setState(s);
  }, []);
  const onChat = useCallback(
    (user: string, text: string) => {
      if (ref.current) set(chatMessage(ref.current, user, text, Date.now()));
    },
    [set],
  );
  const act = (a: StreamerAct) => ref.current && set(streamerAct(ref.current, a, Date.now()));

  async function next() {
    if (!ref.current || busy) return;
    setBusy(true);
    try {
      set(deal(ref.current, await fetchQuestion(), Date.now()));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطأ');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    fetch(`${SERVER_URL}/api/kick/status`)
      .then((r) => r.json())
      .then((d: { enabled?: boolean }) => setCanLink(Boolean(d.enabled)))
      .catch(() => {});
  }, []);

  // Clock: drives the countdown and the timeouts.
  useEffect(() => {
    if (!state) return;
    const t = setInterval(() => {
      setNow(Date.now());
      if (ref.current) {
        const after = tick(ref.current, Date.now());
        if (after !== ref.current) set(after);
      }
    }, 500);
    return () => clearInterval(t);
  }, [state === null, set]); // eslint-disable-line react-hooks/exhaustive-deps

  const playing = state !== null;
  useEffect(() => {
    if (!playing || test) return;
    const socket: KickSocket = io(`${SERVER_URL}/kick`);
    socket.on('connect', () =>
      socket.emit('kick:watch', { channel: channel.trim(), official: Boolean(linked) || undefined }, (res) => {
        if (!res.ok) setStatus({ state: 'error', detail: res.error });
      }),
    );
    socket.on('kick:status', setStatus);
    socket.on('kick:message', (m) => onChat(m.user, m.text));
    socket.on('connect_error', () => setStatus({ state: 'error', detail: 'تعذّر الاتصال بالسيرفر' }));
    return () => {
      socket.disconnect();
    };
  }, [playing, test, channel, linked, onChat]);

  async function start(testMode: boolean) {
    const name = channel.trim() || 'الستريمر';
    if (!testMode && !KICK_CHANNEL_RE.test(name)) return setError('اكتب اسم قناتك في Kick (حروف إنجليزية وأرقام)');
    setTest(testMode);
    setStatus({ state: 'connecting' });
    ref.current = newStream(name, rounds);
    setBusy(true);
    try {
      set(deal(ref.current, await fetchQuestion(), Date.now()));
      setError('');
    } catch (e) {
      ref.current = null;
      setError(e instanceof Error ? e.message : 'خطأ');
    } finally {
      setBusy(false);
    }
  }

  if (!state) {
    return (
      <div className="min-h-dvh bg-q-bg px-4 py-8 font-sans text-white" dir="rtl">
        <div className="mx-auto max-w-md">
          <h1 className="mb-1 text-center text-2xl font-black text-q-gold">🎮 جاوب أو بادل — بث Kick</h1>
          <p className="mb-5 text-center text-xs text-white/50">أنت والشات تلعبون بالتناوب، وكل لاعب نقاطه لحاله</p>
          <div className="q-card">
            {canLink && (
              <div className="mb-3 rounded-xl border border-q-line bg-q-panel p-3 text-center">
                {linked ? (
                  <p className="text-sm font-black text-emerald-400">✅ تم ربط حسابك: {linked}</p>
                ) : (
                  <a href={`${SERVER_URL}/api/kick/login?next=quiz`} className="q-btn-gold inline-block rounded-xl px-4 py-2 text-sm font-black">
                    🔗 اربط حسابك في Kick
                  </a>
                )}
              </div>
            )}
            <label className="mb-1 block text-xs text-white/60">اسم قناتك في Kick</label>
            <input className="q-input mb-3" dir="ltr" value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="streamer_name" />
            <label className="mb-1 block text-xs text-white/60">عدد الأسئلة</label>
            <div className="mb-3 grid grid-cols-3 gap-2">
              {[10, 15, 20].map((n) => (
                <button key={n} type="button" onClick={() => setRounds(n)} className={cn('rounded-xl border-2 py-2 text-sm font-black', rounds === n ? 'border-q-gold bg-q-gold/8' : 'border-q-line bg-q-panel')}>
                  {n}
                </button>
              ))}
            </div>
            {error && <div className="mb-2 text-center text-sm text-q-red">{error}</div>}
            <button type="button" className="q-btn-gold" disabled={busy} onClick={() => void start(false)}>
              🔴 ابدأ البث
            </button>
            <button type="button" className="mt-2 w-full text-xs text-white/50 underline" onClick={() => void start(true)}>
              تجربة بدون Kick (تكتب رسائل الشات بنفسك)
            </button>
          </div>
        </div>
      </div>
    );
  }

  const q = state.question!;
  const left = state.deadline ? Math.max(0, Math.ceil((state.deadline - now) / 1000)) : null;
  const holderName = displayName(state, state.holder);
  const answererName = state.answerer === null ? displayName(state, null) : displayName(state, state.answerer);
  const dot = status.state === 'live' ? 'bg-q-green' : status.state === 'error' ? 'bg-q-red' : 'bg-q-gold';
  const rows = standings(state);
  const showQuestion = state.phase === 'answer' || state.phase === 'result' || state.phase === 'over';
  const chatters = state.seen.filter((k) => k !== state.streamer).slice().reverse();

  return (
    <div className="min-h-dvh bg-q-bg p-3 font-sans text-white" dir="rtl">
      <div className="mx-auto mb-2 flex max-w-5xl items-center justify-between text-xs">
        <span className="text-white/70">السؤال {state.round} من {state.totalRounds}</span>
        <span className="flex items-center gap-2">
          {test ? '🧪 وضع التجربة' : <><span className={cn('size-2 rounded-full', dot)} />{status.state === 'live' ? 'متصل بالشات' : status.detail ?? 'جاري الاتصال...'}</>}
        </span>
      </div>
      <div className="mx-auto grid max-w-5xl gap-3 md:grid-cols-[1fr_16rem]">
        <div className="q-card">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="rounded-full bg-q-gold/15 px-3 py-1 font-black text-q-gold">{q.points} نقطة{q.categoryName ? ` · ${q.categoryName}` : ''}</span>
            {left !== null && <span className="font-black tabular-nums text-q-cyan">⏱ {left}</span>}
          </div>

          {state.phase === 'choose' && (
            <div className="py-6 text-center">
              {state.holder === null ? (
                <>
                  <div className="mb-4 text-xl font-black">دورك! اختر قبل ما يظهر السؤال</div>
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" className="q-btn-gold" onClick={() => act({ type: 'choose', choice: 'answer' })}>✅ جاوب</button>
                    <button type="button" className="rounded-xl border-2 border-q-cyan py-3 text-lg font-black" onClick={() => act({ type: 'choose', choice: 'swap' })}>🔄 بادل</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-2 text-xl font-black">دور <b className="text-q-gold">{holderName}</b></div>
                  <div className="text-white/70">يكتب في الشات: <b className="text-q-gold">2</b> = جاوب، <b className="text-q-cyan">1</b> = بادل (مع الستريمر)</div>
                </>
              )}
            </div>
          )}

          {state.phase === 'partner' && (
            <div>
              <div className="mb-3 text-center text-lg font-black">مع مين تبادل؟ اختر من الشات</div>
              {chatters.length === 0 ? (
                <p className="py-6 text-center text-white/50">ما أحد كتب في الشات للحين… انتظر أحد يكتب أي شيء.</p>
              ) : (
                <div className="flex max-h-72 flex-wrap gap-2 overflow-auto">
                  {chatters.map((k) => (
                    <button key={k} type="button" className="rounded-xl border-2 border-q-line bg-q-panel px-3 py-2 text-sm font-black hover:border-q-gold" onClick={() => act({ type: 'partner', user: k })}>
                      {displayName(state, k)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {showQuestion && (
            <div>
              <div className="mb-1 text-center text-xs text-white/60">
                {state.choice === 'swap' ? `🔄 ${holderName} بادل — الجواب على ${answererName}` : `✅ ${holderName} جاوب`}
              </div>
              {q.imageUrl && <img src={q.imageUrl} alt="" className="mx-auto mb-3 max-h-60 rounded-xl object-contain" />}
              <div className="mb-4 text-center text-2xl font-black leading-snug">{q.text}</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {q.options.map((o, i) => {
                  const res = state.result;
                  const right = res && i === q.correctIndex;
                  const wrongPick = res && res.picked === i && !res.correct;
                  const canClick = state.phase === 'answer' && state.answerer === null;
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={!canClick}
                      onClick={() => act({ type: 'option', index: i })}
                      className={cn('flex items-center gap-2 rounded-xl border-2 p-3 text-start text-lg font-black', right ? 'border-q-green bg-q-green/15' : wrongPick ? 'border-q-red bg-q-red/15' : 'border-q-line bg-q-panel')}
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-q-gold/15 text-q-gold">{i + 1}</span>
                      {o}
                    </button>
                  );
                })}
              </div>
              {state.phase === 'answer' && state.answerer !== null && (
                <p className="mt-3 text-center text-sm text-white/70">
                  <b className="text-q-gold">{answererName}</b> يكتب رقم الخيار (1-4) أو <b>جاوب</b> + الجواب
                </p>
              )}
              {state.phase === 'answer' && state.answerer === null && <p className="mt-3 text-center text-sm text-white/70">اختر جوابك</p>}
            </div>
          )}

          {(state.phase === 'result' || state.phase === 'over') && state.result && (
            <div className="mt-4 text-center">
              <div className={cn('mb-1 text-xl font-black', state.result.correct ? 'text-q-green' : 'text-q-red')}>
                {state.result.picked === null ? '⏱ انتهى الوقت' : state.result.correct ? '✅ إجابة صحيحة' : '❌ إجابة خاطئة'}
              </div>
              <div className="mb-3 text-sm text-white/70">
                {Object.entries(state.result.deltas).map(([k, d]) => (
                  <span key={k} className="mx-1"><b>{displayName(state, k)}</b> <bdi dir="ltr" className={d < 0 ? 'text-q-red' : 'text-q-green'}>{d > 0 ? `+${d}` : d}</bdi></span>
                ))}
              </div>
              {state.phase === 'result' ? (
                <button type="button" className="q-btn-gold" disabled={busy} onClick={() => void next()}>السؤال التالي ◀</button>
              ) : (
                <div className="text-xl font-black text-q-gold">🏆 الفائز: {rows[0]?.name}</div>
              )}
            </div>
          )}
          {error && <div className="mt-2 text-center text-sm text-q-red">{error}</div>}
        </div>

        <div className="q-card">
          <div className="mb-2 text-sm font-black text-q-gold">الترتيب</div>
          <ol className="space-y-1 text-sm">
            {rows.slice(0, 12).map((r, i) => (
              <li key={r.key} className="flex justify-between gap-2">
                <span>{i + 1}. {r.name}{r.streamer ? ' 🎙️' : ''}</span>
                <bdi dir="ltr" className="font-black tabular-nums">{r.score}</bdi>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[11px] leading-relaxed text-white/40">للانضمام للأدوار: اكتب «دخول» في الشات. كل من يكتب في الشات يظهر في قائمة المبادلة.</p>
          {test && (
            <form
              className="mt-3 flex gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                const m = /^([^:]+):(.+)$/.exec(fake.trim());
                if (m) onChat(m[1]!.trim(), m[2]!.trim());
                setFake('');
              }}
            >
              <input className="q-input flex-1 text-xs" dir="ltr" value={fake} onChange={(e) => setFake(e.target.value)} placeholder="ali: دخول" />
              <button className="rounded-lg bg-q-gold/20 px-2 text-xs font-black">إرسال</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
