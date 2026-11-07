import {
  chatMessage,
  deal,
  finish,
  KICK_CHANNEL_RE,
  newStream,
  POINTS,
  standings,
  streamerAct,
  tick,
  toBoard,
  type KickClientToServerEvents,
  type KickServerToClientEvents,
  type KickStatus,
  type PublicCategory,
  type StreamOutcome,
  type StreamQuestion,
  type StreamState,
  type StreamerAct,
} from '@quiz/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { api } from '@/lib/api';
import { SERVER_URL } from '@/lib/server';
import { cn } from '@/lib/utils';

type KickSocket = Socket<KickServerToClientEvents, KickClientToServerEvents>;
const MAX_CATEGORIES = 6;

async function fetchQuestion(category: number, points: number): Promise<StreamQuestion> {
  const res = await fetch(`${SERVER_URL}/api/kick/question?category=${category}&points=${points}`);
  if (!res.ok) throw new Error('تعذّر جلب سؤال لهذه الخانة');
  return (await res.json()) as StreamQuestion;
}

const OUTCOME: Record<StreamOutcome, { label: string; cls: string }> = {
  'answer-right': { label: '✅ جاوب صح', cls: 'text-q-green' },
  'answer-wrong': { label: '❌ جاوب غلط', cls: 'text-q-red' },
  'swap-win': { label: '🔄 بادل وربح', cls: 'text-q-green' },
  'swap-lose': { label: '🔄 بادل وخسر', cls: 'text-q-red' },
  idle: { label: '⏱ ما جاوب', cls: 'text-white/50' },
};

/** «جاوب أو بادل» on a Kick stream: the streamer picks the cell, then the streamer and the whole chat play it. */
export function KickQuizPage() {
  const params = new URLSearchParams(window.location.search);
  const [linked] = useState(params.get('linked') ?? '');
  const [canLink, setCanLink] = useState(false);
  const [channel, setChannel] = useState(params.get('linked') ?? '');
  const [cats, setCats] = useState<PublicCategory[]>([]);
  const [chosen, setChosen] = useState<number[]>([]);
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

  useEffect(() => {
    fetch(`${SERVER_URL}/api/kick/status`)
      .then((r) => r.json())
      .then((d: { enabled?: boolean }) => setCanLink(Boolean(d.enabled)))
      .catch(() => {});
    api.publicCategories().then((c) => setCats(c.filter((x) => x.playable))).catch(() => setError('تعذّر تحميل الفئات'));
  }, []);

  const playing = state !== null;
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setNow(Date.now());
      if (ref.current) {
        const after = tick(ref.current, Date.now());
        if (after !== ref.current) set(after);
      }
    }, 500);
    return () => clearInterval(t);
  }, [playing, set]);

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

  function start(testMode: boolean) {
    const name = channel.trim() || 'الستريمر';
    if (!testMode && !KICK_CHANNEL_RE.test(name)) return setError('اكتب اسم قناتك في Kick (حروف إنجليزية وأرقام)');
    if (chosen.length < 2) return setError('اختر فئتين على الأقل');
    setTest(testMode);
    setStatus({ state: 'connecting' });
    setError('');
    set(toBoard(newStream(name, chosen.length * POINTS.length)));
  }

  async function pick(category: number, points: number) {
    if (!ref.current || busy) return;
    setBusy(true);
    try {
      set(deal(ref.current, `${category}:${points}`, await fetchQuestion(category, points), Date.now()));
      setError('');
    } catch (e) {
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
          <p className="mb-5 text-center text-xs text-white/50">أنت والشات كله تجاوبون نفس السؤال، وكل لاعب نقاطه لحاله</p>
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
            <label className="mb-1 block text-xs text-white/60">اختر الفئات ({chosen.length}/{MAX_CATEGORIES})</label>
            <div className="mb-3 grid grid-cols-2 gap-2">
              {cats.map((c) => {
                const on = chosen.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setChosen((cur) => (on ? cur.filter((x) => x !== c.id) : cur.length < MAX_CATEGORIES ? [...cur, c.id] : cur))}
                    className={cn('rounded-xl border-2 px-2 py-2 text-sm font-black', on ? 'border-q-gold bg-q-gold/8' : 'border-q-line bg-q-panel')}
                  >
                    {c.icon} {c.name}
                  </button>
                );
              })}
            </div>
            {error && <div className="mb-2 text-center text-sm text-q-red">{error}</div>}
            <button type="button" className="q-btn-gold" onClick={() => start(false)}>
              🔴 ابدأ البث
            </button>
            <button type="button" className="mt-2 w-full text-xs text-white/50 underline" onClick={() => start(true)}>
              تجربة بدون Kick (تكتب رسائل الشات بنفسك)
            </button>
          </div>
        </div>
      </div>
    );
  }

  const rows = standings(state);
  const top = rows.slice(0, 10);
  const r = state.round;
  const q = r?.question;
  const left = state.deadline ? Math.max(0, Math.ceil((state.deadline - now) / 1000)) : null;
  const dot = status.state === 'live' ? 'bg-q-green' : status.state === 'error' ? 'bg-q-red' : 'bg-q-gold';
  const showQuestion = state.phase === 'answer' || state.phase === 'result';
  const result = state.result;
  const swappers = r ? Object.values(r.choices).filter((c) => c === 'swap').length : 0;
  const answerers = r ? Object.values(r.choices).filter((c) => c === 'answer').length : 0;
  const answered = r ? Object.keys(r.picks).length : 0;

  return (
    <div className="min-h-dvh bg-q-bg p-3 font-sans text-white" dir="rtl">
      <div className="mx-auto mb-2 flex max-w-5xl items-center justify-between text-xs">
        <span className="text-white/70">اللعب: {state.used.length} من {state.totalCells} سؤال</span>
        <span className="flex items-center gap-2">
          {test ? '🧪 وضع التجربة' : <><span className={cn('size-2 rounded-full', dot)} />{status.state === 'live' ? 'متصل بالشات' : status.detail ?? 'جاري الاتصال...'}</>}
        </span>
      </div>
      <div className="mx-auto grid max-w-5xl gap-3 md:grid-cols-[1fr_17rem]">
        <div className="q-card">
          {state.phase === 'board' && (
            <div>
              <div className="mb-3 text-center text-lg font-black">اختر سؤال من اللوحة</div>
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${chosen.length}, minmax(0, 1fr))` }}>
                {chosen.map((id) => {
                  const c = cats.find((x) => x.id === id);
                  return (
                    <div key={id} className="truncate rounded-lg bg-q-panel py-2 text-center text-xs font-black">
                      {c?.icon} {c?.name}
                    </div>
                  );
                })}
                {POINTS.flatMap((p) =>
                  chosen.map((id) => {
                    const used = state.used.includes(`${id}:${p}`);
                    return (
                      <button
                        key={`${id}:${p}`}
                        type="button"
                        disabled={used || busy}
                        onClick={() => void pick(id, p)}
                        className={cn('rounded-lg border-2 py-3 text-lg font-black', used ? 'border-transparent bg-white/5 text-white/15' : 'border-q-line bg-q-panel text-q-gold hover:border-q-gold')}
                      >
                        {p}
                      </button>
                    );
                  }),
                )}
              </div>
              <button type="button" className="mt-3 w-full text-xs text-white/50 underline" onClick={() => set(finish(state))}>إنهاء اللعبة وعرض الفائز</button>
            </div>
          )}

          {state.phase === 'choose' && q && (
            <div className="py-4 text-center">
              <div className="mb-1 text-sm text-q-gold">{q.points} نقطة{q.categoryName ? ` · ${q.categoryName}` : ''}</div>
              <div className="mb-3 text-2xl font-black">اختاروا قبل ما يظهر السؤال!</div>
              <div className="mx-auto mb-3 max-w-sm space-y-1 rounded-xl bg-q-panel p-3 text-lg">
                <div>اكتبوا <b className="text-q-gold">2</b> = جاوب</div>
                <div>اكتبوا <b className="text-q-cyan">1</b> = بادل مع الستريمر</div>
              </div>
              <div className="mb-3 text-sm text-white/70">✅ جاوب: {answerers} · 🔄 بادل: {swappers}</div>
              {left !== null && <div className="mb-3 text-3xl font-black tabular-nums text-q-cyan">⏱ {left}</div>}
              <button type="button" className="q-btn-gold" onClick={() => act({ type: 'show' })}>اعرض السؤال الآن</button>
            </div>
          )}

          {showQuestion && q && r && (
            <div>
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="rounded-full bg-q-gold/15 px-3 py-1 font-black text-q-gold">{q.points} نقطة{q.categoryName ? ` · ${q.categoryName}` : ''}</span>
                {state.phase === 'answer' && left !== null && <span className="font-black tabular-nums text-q-cyan">⏱ {left}</span>}
              </div>
              {q.imageUrl && <img src={q.imageUrl} alt="" className="mx-auto mb-3 max-h-60 rounded-xl object-contain" />}
              <div className="mb-4 text-center text-2xl font-black leading-snug">{q.text}</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {q.options.map((o, i) => {
                  const right = result && i === result.correctIndex;
                  const mine = r.picks[state.streamer] === i;
                  const canClick = state.phase === 'answer' && r.picks[state.streamer] === undefined;
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={!canClick}
                      onClick={() => act({ type: 'option', index: i })}
                      className={cn(
                        'flex items-center gap-2 rounded-xl border-2 p-3 text-start text-lg font-black',
                        right ? 'border-q-green bg-q-green/15' : mine && result ? 'border-q-red bg-q-red/15' : mine ? 'border-q-gold bg-q-gold/10' : 'border-q-line bg-q-panel',
                      )}
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-q-gold/15 text-q-gold">{i + 1}</span>
                      {o}
                    </button>
                  );
                })}
              </div>
              {state.phase === 'answer' && (
                <div className="mt-3 text-center text-sm text-white/70">
                  {r.picks[state.streamer] === undefined ? 'اختر جوابك — ' : 'تم اختيارك — '}
                  الشات يكتب رقم الخيار (1-4) أو <b>جاوب</b> + الجواب · أجاب {answered} · بادل {swappers}
                  <button type="button" className="q-btn-gold mt-3" onClick={() => act({ type: 'finish' })}>أنهِ السؤال وأظهر النتائج</button>
                </div>
              )}
            </div>
          )}

          {state.phase === 'result' && result && (
            <div className="mt-4 text-center">
              <div className={cn('mb-1 text-xl font-black', result.streamerCorrect ? 'text-q-green' : 'text-q-red')}>
                {result.streamerPick === null ? '⏱ ما جاوبت' : result.streamerCorrect ? '✅ جوابك صح' : '❌ جوابك غلط'}
                {swappers > 0 && <span className="text-sm text-white/70"> — المبادلون {result.streamerCorrect ? 'ضاعفوا نقاطهم' : 'خسروا النقاط'}</span>}
              </div>
              <button type="button" className="q-btn-gold mt-2" onClick={() => set(toBoard(state))}>اللوحة ◀</button>
            </div>
          )}

          {state.phase === 'over' && (
            <div className="py-6 text-center">
              <div className="mb-2 text-3xl">🏆</div>
              <div className="text-2xl font-black text-q-gold">الفائز: {rows[0]?.name}</div>
              <div className="mt-1 text-sm text-white/60">{rows[0]?.score} نقطة</div>
            </div>
          )}
          {error && <div className="mt-2 text-center text-sm text-q-red">{error}</div>}
        </div>

        <div className="q-card">
          <div className="mb-2 text-sm font-black text-q-gold">{state.phase === 'result' ? 'أفضل 10 بعد هذا السؤال' : 'أفضل 10'}</div>
          <ol className="space-y-1.5 text-sm">
            {top.map((row, i) => {
              const o = state.phase === 'result' && row.outcome ? OUTCOME[row.outcome] : null;
              return (
                <li key={row.key}>
                  <div className="flex justify-between gap-2">
                    <span className="truncate">{i + 1}. {row.name}{row.streamer ? ' 🎙️' : ''}</span>
                    <bdi dir="ltr" className="font-black tabular-nums">{row.score}</bdi>
                  </div>
                  {o && (
                    <div className={cn('text-[11px]', o.cls)}>
                      {o.label} <bdi dir="ltr">{row.delta > 0 ? `+${row.delta}` : row.delta}</bdi>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-[11px] leading-relaxed text-white/40">كل من يكتب في الشات يلعب، ما يحتاج «دخول».</p>
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
              <input className="q-input flex-1 text-xs" dir="ltr" value={fake} onChange={(e) => setFake(e.target.value)} placeholder="ali: 2" />
              <button className="rounded-lg bg-q-gold/20 px-2 text-xs font-black">إرسال</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
