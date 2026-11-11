import {
  chatMessage,
  kickPlayer,
  deal,
  finish,
  KICK_CHANNEL_RE,
  newStream,
  publicView,
  POINTS,
  STREAM_ANSWER_CHOICES,
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
  type StreamVariant,
  streamLabels,
  hideQuestion,
  packDeck,
  packQuestion,
  type PackQuestion,
  type QuestionPack,
  randomHidePoints,
  STREAM_HIDE_LEVELS,
  type SyncClientToServerEvents,
  type SyncServerToClientEvents,
} from '@quiz/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { tripleLines, toneClass } from './tripleText';
import { Logo } from '@/game/screens/HomeScreen';
import { io, type Socket } from 'socket.io-client';
import { api } from '@/lib/api';
import { SERVER_URL } from '@/lib/server';
import { cn } from '@/lib/utils';
import { Background3D } from '@/game/fx/Background3D';
import { QuestionImage } from '@/game/ui';
import { BoardGrid } from './BoardGrid';
import { HideBoxes } from './HideBoxes';
import { ShuffleBoxes } from './ShuffleBoxes';
import { AboutBadge, FaceGrid } from './PackParts';
import { Podium } from './Podium';
import { QuizHowToButton } from './QuizHowTo';

type KickSocket = Socket<KickServerToClientEvents, KickClientToServerEvents>;
const MAX_CATEGORIES = 6;
const randomId = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');

async function fetchQuestion(category: number, points: number): Promise<StreamQuestion> {
  const res = await fetch(`${SERVER_URL}/api/kick/question?category=${category}&points=${points}`);
  if (!res.ok) throw new Error('تعذّر جلب سؤال لهذه الخانة');
  return (await res.json()) as StreamQuestion;
}

export const OUTCOME: Record<StreamOutcome, { label: string; cls: string }> = {
  'answer-right': { label: '✅ جاوب صح', cls: 'text-q-green' },
  'answer-wrong': { label: '❌ جاوب غلط', cls: 'text-q-red' },
  'swap-win': { label: '🔄 بادل وربح', cls: 'text-q-green' },
  'swap-lose': { label: '🔄 بادل وخسر', cls: 'text-q-red' },
  flip: { label: '🔀 قلب', cls: 'text-q-cyan' },
  'flipped-right': { label: '🔀 انقلب عليه (جوابه صح)', cls: 'text-q-red' },
  'flipped-wrong': { label: '🔀 انقلب عليه (جوابه غلط)', cls: 'text-q-green' },
  'hid-safe': { label: '🔒 ما أحد لقى المفتاح', cls: 'text-q-green' },
  'hid-found': { label: '🔓 لقوا المفتاح', cls: 'text-white/50' },
  stolen: { label: '💸 الستريمر أخذ نقاطه', cls: 'text-q-red' },
  'reverse-win': { label: '↩️ عكس وربح (جواب اللي عكس عليه غلط)', cls: 'text-q-green' },
  'reverse-lose': { label: '↩️ عكس وخسر (جواب اللي عكس عليه صح)', cls: 'text-q-red' },
  mutual: { label: '🤝 اختار هو والستريمر بعض — صفر', cls: 'text-q-gold' },
  void: { label: '🚫 الستريمر ما جاوب بنفسه — ما فيه شي ينعكس أو يتبادل', cls: 'text-white/50' },
  robbed: { label: '😵 انزرف! جوابه صح بس النقاط راحت للي بادل', cls: 'text-q-gold' },
  idle: { label: '⏱ ما جاوب', cls: 'text-white/50' },
};

/** The result label for a player; «خبّي أو اكشف» speaks of finding the key instead of answering. */
export function outcomeLabel(variant: StreamVariant | undefined, outcome: StreamOutcome) {
  if (variant === 'hide' && outcome === 'answer-right') return { label: '🔑 لقى المفتاح', cls: 'text-q-green' };
  if (variant === 'hide' && outcome === 'answer-wrong') return { label: '📭 ما لقاه', cls: 'text-q-red' };
  return OUTCOME[outcome];
}

/** «جاوب أو بادل» on a Kick stream: the streamer picks the cell, then the streamer and the whole chat play it. */
export function KickQuizPage() {
  const params = new URLSearchParams(window.location.search);
  const [linked] = useState(params.get('linked') ?? '');
  const [canLink, setCanLink] = useState(false);
  const [channel, setChannel] = useState(params.get('linked') ?? '');
  const [cats, setCats] = useState<PublicCategory[]>([]);
  const [chosen, setChosen] = useState<number[]>([]);
  const [test, setTest] = useState(false);
  const [answerSec, setAnswerSec] = useState<number>(30);
  const [hideRounds, setHideRounds] = useState(10);
  // A team's private pack (by code): its questions stay here on the control page, in the order of play.
  const [packCode, setPackCode] = useState('');
  const [pack, setPack] = useState<QuestionPack | null>(null);
  const deck = useRef<PackQuestion[]>([]);
  const [variant, setVariant] = useState<StreamVariant>('swap');
  const [error, setError] = useState(params.get('kick_error') ?? '');
  const [state, setState] = useState<StreamState | null>(null);
  const [status, setStatus] = useState<KickStatus>({ state: 'connecting' });
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [fake, setFake] = useState('');
  const ref = useRef<StreamState | null>(null);
  // Pairing with the broadcast page: it shows the game without the streamer's secrets.
  // The code and its owner key live together for this tab, so a reloaded tab (iPad Safari reloads background tabs)
  // still owns its code instead of being refused by the server as a stranger.
  const [sync, setSync] = useState<{ code: string; key: string }>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('kick-sync') ?? 'null') as { code?: string; key?: string } | null;
      if (saved?.code && saved.key) return { code: saved.code, key: saved.key };
    } catch {
      /* private mode or bad value */
    }
    return { code: randomId(8), key: randomId(24) };
  });
  const syncCode = sync.code;
  const hostKey = useRef(sync.key);
  hostKey.current = sync.key;
  const [syncOk, setSyncOk] = useState<boolean | null>(null);
  const syncSocket = useRef<Socket<SyncServerToClientEvents, SyncClientToServerEvents> | null>(null);
  const [copied, setCopied] = useState(false);
  const publishNow = useRef<() => void>(() => {});
  const pickRef = useRef<(category: number, points: number) => Promise<void>>(async () => {});

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

  // Always publish the latest game, also after the socket dropped and came back (e.g. a backgrounded tab), and every few seconds
  // so a restarted server or a late-opened broadcast page catches up.
  const latest = useRef<StreamState | null>(null);
  latest.current = state;
  useEffect(() => {
    try {
      sessionStorage.setItem('kick-sync', JSON.stringify(sync));
    } catch {
      /* private mode */
    }
    const sock: Socket<SyncServerToClientEvents, SyncClientToServerEvents> = io(`${SERVER_URL}/kick-sync`);
    syncSocket.current = sock;
    const publish = () => {
      if (!sock.connected) return;
      const st = latest.current;
      sock.emit('sync:publish', { code: syncCode, hostKey: hostKey.current, state: st ? publicView(st) : null, hostNow: Date.now() }, (res) => {
        setSyncOk(res.ok);
        // Someone else owns this code (an old session): take a fresh one; the link on screen changes with it.
        if (!res.ok && res.error === 'هذا الكود مستخدم') setSync({ code: randomId(8), key: randomId(24) });
      });
    };
    sock.on('connect', publish);
    sock.on('sync:pick', (m) => void pickRef.current(m.category, m.points));
    const beat = setInterval(publish, 3000);
    publishNow.current = publish;
    return () => {
      clearInterval(beat);
      sock.disconnect();
      syncSocket.current = null;
      publishNow.current = () => {};
    };
  }, [syncCode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    publishNow.current();
  }, [state]);

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
    setTest(testMode);
    setStatus({ state: 'connecting' });
    setError('');
    // The lobby: chat connects and viewers join; categories and the answer time are picked there.
    set({ ...newStream(name, 0), test: testMode });
  }

  pickRef.current = pick;

  /** Back to the start page; the broadcast screen goes back to waiting. */
  function playAgain() {
    ref.current = null;
    setState(null);
    setError('');
  }

  async function loadPack() {
    if (!packCode.trim()) return;
    try {
      const res = await fetch(`${SERVER_URL}/api/kick/pack/${encodeURIComponent(packCode.trim())}`);
      if (!res.ok) throw new Error();
      const p = (await res.json()) as QuestionPack;
      setPack(p);
      if (variant === 'hide') setVariant('swap');
      setError('');
    } catch {
      setPack(null);
      setError('كود الحزمة غير صحيح');
    }
  }

  function dealPack() {
    const cur = ref.current;
    if (!cur || !pack || cur.phase !== 'board') return;
    const next = deck.current[cur.used.length];
    if (!next) return set(finish(cur));
    set(deal(cur, `p:${cur.used.length + 1}`, packQuestion(pack, next), Date.now()));
  }

  function beginGame() {
    if (!ref.current) return;
    if (pack && variant !== 'hide') {
      deck.current = packDeck(pack);
      setError('');
      set(toBoard({ ...ref.current, totalCells: deck.current.length, answerMs: answerSec * 1000, board: undefined, variant, pack: { name: pack.name, total: deck.current.length, logo: pack.logo } }));
      return;
    }
    if (variant === 'hide') {
      setError('');
      set(toBoard({ ...ref.current, totalCells: hideRounds, answerMs: answerSec * 1000, board: undefined, variant }));
      return;
    }
    if (chosen.length < 2) return setError('اختر فئتين على الأقل');
    setError('');
    const board = chosen.map((id) => {
      const c = cats.find((x) => x.id === id);
      return { id, name: c?.name ?? '', icon: c?.icon ?? '' };
    });
    set(toBoard({ ...ref.current, totalCells: chosen.length * POINTS.length, answerMs: answerSec * 1000, board, variant }));
  }

  async function pick(category: number, points: number) {
    const cur = ref.current;
    if (!cur || busy || cur.phase !== 'board' || !cur.board?.some((c) => c.id === category) || cur.used.includes(`${category}:${points}`)) return;
    setBusy(true);
    try {
      const question = await fetchQuestion(category, points);
      if (ref.current) set(deal(ref.current, `${category}:${points}`, question, Date.now()));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطأ');
    } finally {
      setBusy(false);
    }
  }

  if (!state) {
    return (
      <div className="min-h-dvh bg-q-bg px-4 py-8 font-sans text-white relative isolate" dir="rtl">
        <Background3D />
        <div className="mx-auto max-w-md">
          <h1 className="flex items-center justify-center gap-2.5 text-[40px] font-black">
            <Logo />
            <span className="text-q-purple">جاوب</span>
            <span className="text-[28px]">أو</span>
            <span className="text-q-cyan">بادل</span>
          </h1>
          <div className="mb-2 flex justify-center">
            <span dir="ltr" className="inline-flex items-center gap-1.5 rounded-lg bg-[#53FC18] px-3 py-0.5 text-sm font-black tracking-[0.2em] text-black shadow-[0_0_22px_-4px_#53FC18]">
              <span className="size-2 rounded-full bg-black motion-safe:animate-pulse" />
              KICK
            </span>
          </div>
          <p className="mb-2 text-center text-xs text-white/50">المشاهدون يكتبون «دخول» عشان يلعبون، وكل لاعب نقاطه لحاله</p>
          <div className="mb-5 text-center">
            <QuizHowToButton forStreamer />
          </div>
          <div className="q-card">
            {canLink && !linked && (
              <a href={`${SERVER_URL}/api/kick/login?next=quiz`} className="q-btn-gold mb-3 block text-center">
                🔗 اربط حسابك في Kick
              </a>
            )}
            {linked ? (
              <div className="mb-3 flex items-center justify-center gap-2 rounded-xl border border-q-green/40 bg-q-green/10 px-3 py-2.5" title="الحساب مربوط">
                <span className="grid size-7 place-items-center rounded-full bg-q-green/20 text-sm">🔗</span>
                <bdi dir="ltr" className="font-black text-white">{linked}</bdi>
                <span className="text-q-green">✓</span>
              </div>
            ) : (
              <>
                <label className="mb-1 block text-xs text-white/60">اسم قناتك في Kick</label>
                <input className="q-input mb-3" dir="ltr" value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="streamer_name" />
              </>
            )}
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

  const L = streamLabels(state.variant);
  const rows = standings(state);
  const top = rows.slice(0, 10);
  const r = state.round;
  const q = r?.question;
  const left = state.deadline ? Math.max(0, Math.ceil((state.deadline - now) / 1000)) : null;
  const dot = status.state === 'live' ? 'bg-q-green' : status.state === 'error' ? 'bg-q-red' : 'bg-q-gold';
    const result = state.result;
  const swappers = r ? Object.values(r.choices).filter((c) => c === 'swap' || c === 'reverse').length : 0;
  const answerers = r ? Object.values(r.choices).filter((c) => c === 'answer').length : 0;
  const answered = r ? Object.keys(r.picks).length : 0;

  return (
    <div className="min-h-dvh bg-q-bg p-3 font-sans text-white relative isolate" dir="rtl">
      <Background3D />
      <div className="mx-auto mb-2 flex max-w-5xl items-center justify-between text-xs">
        <span className="flex items-center gap-2 text-white/70">{state.phase === 'lobby' ? 'قبل بداية اللعبة' : `اللعب: ${state.used.length} من ${state.totalCells} ${state.variant === 'hide' ? 'جولة' : 'سؤال'}${state.pack ? ` · ${state.pack.name}` : ''}`} <QuizHowToButton forStreamer variant={state.phase === 'lobby' ? undefined : (state.variant ?? 'swap')} className="px-2.5 py-0.5 text-[11px]" /></span>
        <span className="flex items-center gap-2">
          {test ? '🧪 وضع التجربة' : <><span className={cn('size-2 rounded-full', dot)} />{status.state === 'live' ? 'متصل بالشات' : status.detail ?? 'جاري الاتصال...'}</>}
        </span>
      </div>
      <div className="mx-auto mb-2 max-w-5xl rounded-xl border border-q-line bg-q-panel px-3 py-2 text-xs text-white/70">
        🖥️ شاشة البث (هذي اللي تبثها، بدون جوابك): <span className="font-black tracking-widest text-white/40">••••••••</span>
        <button
          type="button"
          className="ms-2 rounded-lg bg-q-gold/20 px-2 py-0.5 font-black"
          onClick={() => {
            void navigator.clipboard?.writeText(`${location.origin}/kick/quiz/screen?code=${syncCode}`).then(() => setCopied(true));
          }}
        >
          {copied ? 'تم النسخ' : 'نسخ الرابط'}
        </button>
        <span className={cn('block text-[11px] font-black', syncOk ? 'text-q-green' : syncOk === false ? 'text-q-red' : 'text-white/50')}>
          {syncOk ? '✅ شاشة البث تستقبل اللعبة' : syncOk === false ? '⚠️ تعذّر إرسال اللعبة لشاشة البث — انسخ الرابط من جديد' : 'جاري الاتصال بشاشة البث...'}
        </span>
        <span className="block text-[11px] text-white/50">هذي الصفحة لك إنت بس (تشوف فيها السؤال وتجاوب) — لا تبثها.</span>
      </div>
      <div className={cn('mx-auto grid max-w-5xl gap-3', state.phase === 'lobby' && !test ? 'max-w-2xl' : 'md:grid-cols-[1fr_17rem]')}>
        <div className="q-card">
          {state.phase === 'lobby' && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-q-gold/30 bg-q-gold/8 p-4 text-center">
                <div className="text-xl font-black">
                  اكتبوا <b className="text-q-gold">دخول</b> في الشات للمشاركة في اللعبة
                </div>
                <div className="mt-3 flex items-center justify-center gap-2 text-sm text-white/70">
                  👥 المشاركون
                  <span className="rounded-full bg-q-cyan/20 px-2.5 py-0.5 font-black text-q-cyan">{state.joined.length}</span>
                </div>
                {state.joined.length > 0 ? (
                  <div className="mt-3 flex max-h-36 flex-wrap justify-center gap-1.5 overflow-auto">
                    {state.joined.map((k) => (
                      <span key={k} className="flex items-center gap-1 rounded-lg border border-q-line bg-q-panel py-1 ps-2 pe-1 text-xs font-black">
                        {state.names[k] ?? k}
                        <KickButton onKick={() => set(kickPlayer(ref.current ?? state, k))} name={state.names[k] ?? k} />
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-white/50">بانتظار أول مشارك...</div>
                )}
              </div>

              <div className="rounded-xl border border-q-line bg-q-panel p-3">
                <div className="mb-2 text-sm font-black">🎭 حزمة فريق خاصة (اختياري)</div>
                {pack ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex -space-x-2 rtl:space-x-reverse">
                      {pack.members.map((m) => (
                        <img key={m.id} src={m.image} alt={m.name} title={m.name} className="size-9 rounded-full border-2 border-q-bg object-cover" />
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {pack.logo && <img src={pack.logo} alt="" className="size-9 rounded-lg object-cover" />}
                      <b className="text-q-gold">{pack.name}</b> · {pack.questions.length} سؤال
                    </div>
                    <button type="button" className="ms-auto text-xs text-white/50 underline" onClick={() => setPack(null)}>
                      إلغاء
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input className="q-input flex-1" dir="ltr" value={packCode} onChange={(e) => setPackCode(e.target.value)} placeholder="CODE-XXXX" />
                    <button type="button" className="rounded-xl border-2 border-q-line px-3 text-sm font-black" onClick={() => void loadPack()}>
                      تحميل
                    </button>
                  </div>
                )}
              </div>

              <div>
                <div className="mb-2 text-sm font-black">🎮 اختر الطور</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(pack ? (['swap', 'flip', 'triple'] as const) : (['swap', 'flip', 'triple', 'hide'] as const)).map((v) => {
                    const l = streamLabels(v);
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setVariant(v)}
                        className={cn('rounded-xl border-2 p-3 text-center transition-all', variant === v ? 'border-q-gold bg-q-gold/8 shadow-[0_0_18px_-6px_rgba(247,201,72,0.6)]' : 'border-q-line bg-q-panel')}
                      >
                        <div className="text-2xl">{l.icon}</div>
                        <div className="font-black text-q-gold">{l.title}</div>
                        <div className="mt-0.5 text-[11px] text-white/60">
                          {v === 'swap' ? 'بادل مع الستريمر: صح = دبل، غلط = ناقص' : v === 'flip' ? 'اقلب على الستريمر: صح = ينقص، غلط = يزيد' : v === 'triple' ? 'بادل = دبل أو ناقص، اعكس = صح ينقص وغلط يزيد' : 'تخبّي المفتاح في صندوق والشات يخمّن من 1 إلى 10'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {pack ? null : variant === 'hide' ? (
                <div>
                  <div className="mb-2 text-sm font-black">🔁 عدد الجولات</div>
                  <div className="grid grid-cols-3 gap-2">
                    {[5, 10, 15].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setHideRounds(n)}
                        className={cn('rounded-xl border-2 py-2 text-sm font-black', hideRounds === n ? 'border-q-gold bg-q-gold/8' : 'border-q-line bg-q-panel')}
                      >
                        {n} جولات
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-black">🗂️ اختر الفئات</span>
                    <span className="text-xs text-white/50">{chosen.length}/{MAX_CATEGORIES}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {cats.map((c) => {
                      const on = chosen.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setChosen((cur) => (on ? cur.filter((x) => x !== c.id) : cur.length < MAX_CATEGORIES ? [...cur, c.id] : cur))}
                          className={cn('rounded-xl border-2 px-2 py-2 text-sm font-black transition-all', on ? 'border-q-gold bg-q-gold/8 shadow-[0_0_18px_-6px_rgba(247,201,72,0.6)]' : 'border-q-line bg-q-panel')}
                        >
                          {c.icon} {c.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <div className="mb-2 text-sm font-black">⏱️ {variant === 'hide' ? 'وقت التخمين' : 'وقت الإجابة على السؤال'}</div>
                <div className="grid grid-cols-5 gap-2">
                  {STREAM_ANSWER_CHOICES.map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setAnswerSec(sec)}
                      className={cn('rounded-xl border-2 py-2 text-sm font-black', answerSec === sec ? 'border-q-gold bg-q-gold/8' : 'border-q-line bg-q-panel')}
                    >
                      {sec} ث
                    </button>
                  ))}
                </div>
              </div>

              <button type="button" className="q-btn-gold" onClick={beginGame}>
                ▶️ ابدأ اللعبة
              </button>
            </div>
          )}

          {state.phase === 'board' && state.pack && (
            <div className="py-4 text-center">
              {state.pack.logo ? <img src={state.pack.logo} alt={state.pack.name} className="mx-auto mb-2 size-20 rounded-2xl object-cover shadow-lg" /> : <div className="mb-1 text-5xl">🎭</div>}
              <div className="mb-1 text-xl font-black">
                {state.pack.name} — السؤال {state.used.length + 1} من {state.pack.total}
              </div>
              <div className="mb-4 text-sm text-white/60">الأسئلة بالترتيب، وكل الفريق ياخذ دوره</div>
              <button type="button" className="q-btn-gold" onClick={dealPack}>
                ▶️ السؤال التالي
              </button>
              <button type="button" className="mt-3 w-full text-xs text-white/50 underline" onClick={() => set(finish(state))}>إنهاء اللعبة وعرض الفائز</button>
            </div>
          )}

          {state.phase === 'board' && state.variant === 'hide' && (
            <div className="py-4 text-center">
              <div className="mb-1 text-5xl">📦</div>
              <div className="mb-1 text-xl font-black">
                الجولة {state.used.length + 1} من {state.totalCells}
              </div>
              <div className="mb-4 text-sm text-white/60">لما تكون جاهز، ابدأ الجولة وخبّي المفتاح</div>
              <button
                type="button"
                className="q-btn-gold"
                onClick={() => ref.current && set(deal(ref.current, `h:${ref.current.used.length + 1}`, hideQuestion(randomHidePoints()), Date.now()))}
              >
                🔑 ابدأ الجولة وخبّي المفتاح
              </button>
              <button type="button" className="mt-3 w-full text-xs text-white/50 underline" onClick={() => set(finish(state))}>إنهاء اللعبة وعرض الفائز</button>
            </div>
          )}

          {state.phase === 'board' && state.variant !== 'hide' && !state.pack && (
            <div>
              <div className="mb-1 text-center text-lg font-black">{busy ? 'جاري جلب السؤال...' : 'اختر السؤال من شاشة البث'}</div>
              <div className="mb-3 text-center text-xs text-white/50">اللوحة هنا للعرض فقط — الضغط على الخانات من شاشة البث</div>
              <BoardGrid board={state.board ?? []} used={state.used} />
              <button type="button" className="mt-3 w-full text-xs text-white/50 underline" onClick={() => set(finish(state))}>إنهاء اللعبة وعرض الفائز</button>
            </div>
          )}

          {state.phase === 'streamer' && q && state.variant === 'hide' && (
            <div className="text-center">
              <div className="mb-2 inline-block rounded-full bg-q-gold/15 px-3 py-1 text-sm font-black text-q-gold">
                {q.points} نقطة · خلط {STREAM_HIDE_LEVELS[q.points as 100 | 200 | 300]?.label}
              </div>
              <div className="mb-1 text-xl font-black">🔑 اختر الصندوق اللي تحط فيه المفتاح</div>
              <div className="mb-4 text-xs text-white/60">الكل يشوف وين حطيته، وبعدها الصناديق تنخلط قدامهم</div>
              <HideBoxes onPick={(i) => act({ type: 'answer', index: i })} />
            </div>
          )}

          {state.phase === 'shuffle' && q && r?.shuffle && (
            <div className="text-center">
              <div className="mb-3 text-xl font-black">🔀 الصناديق تنخلط…</div>
              <ShuffleBoxes shuffle={r.shuffle} startAt={r.shuffleAt ?? 0} hostNow={Date.now} />
            </div>
          )}

          {state.phase === 'streamer' && q && state.variant !== 'hide' && (
            <div>
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="rounded-full bg-q-gold/15 px-3 py-1 font-black text-q-gold">{q.points} نقطة{q.categoryName ? ` · ${q.categoryName}` : ''}</span>
                <span className="text-xs text-white/60">دورك أول — اختيارك يبقى مخفي عن الشات</span>
              </div>
              <QuestionImage url={q.imageUrl} type={q.type ?? 'text'} large />
              <AboutBadge q={q} />
              <div className="mb-4 text-center text-2xl font-black leading-snug">{q.text}</div>
              <div className="mb-1 text-center text-xs text-white/60">جاوب: اضغط {q.faces ? 'الشخص' : 'الخيار'} اللي تبيه</div>
              {q.faces ? (
                <FaceGrid q={q} now={now} onPick={(i) => act({ type: 'answer', index: i })} />
              ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {q.options.map((o, i) => (
                  <button key={i} type="button" onClick={() => act({ type: 'answer', index: i })} className="flex items-center gap-2 rounded-xl border-2 border-q-line bg-q-panel p-3 text-start text-lg font-black hover:border-q-gold">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-q-gold/15 text-q-gold">{i + 1}</span>
                    {o}
                  </button>
                ))}
              </div>
              )}
              <div className="mt-4 rounded-xl border border-q-line bg-q-panel p-3">
                <div className="mb-2 text-center text-sm font-black text-q-cyan">{L.icon} {L.withPlayer}</div>
                {state.joined.length === 0 ? (
                  <p className="text-center text-xs text-white/50">ما أحد دخل للحين. اطلبوا من الشات يكتبون «دخول».</p>
                ) : (
                  <div className="flex max-h-32 flex-wrap justify-center gap-2 overflow-auto">
                    {state.joined.map((k) =>
                      state.variant === 'triple' ? (
                        <span key={k} className="flex items-center gap-1 rounded-lg border-2 border-q-line py-1 ps-3 pe-1 text-sm font-black">
                          {state.names[k]}
                          <button type="button" className="rounded-md bg-q-cyan/15 px-2 py-0.5 text-xs text-q-cyan hover:bg-q-cyan/30" onClick={() => act({ type: 'swap', user: k })}>🔄 بادل</button>
                          <button type="button" className="rounded-md bg-q-purple/20 px-2 py-0.5 text-xs text-q-purple hover:bg-q-purple/35" onClick={() => act({ type: 'reverse', user: k })}>↩️ اعكس</button>
                        </span>
                      ) : (
                        <button key={k} type="button" className="rounded-lg border-2 border-q-line px-3 py-1.5 text-sm font-black hover:border-q-cyan" onClick={() => act({ type: 'swap', user: k })}>
                          {state.names[k]}
                        </button>
                      ),
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {state.phase === 'choose' && q && (
            <div className="py-2 text-center">
              <div className="mb-1 text-sm text-q-gold">{q.points} نقطة{q.categoryName ? ` · ${q.categoryName}` : ''}</div>
              <QuestionImage url={q.imageUrl} type={q.type ?? 'text'} large />
              <div className="mb-3 text-2xl font-black leading-snug">{q.text}</div>
              <div className="mx-auto mb-2 max-w-sm space-y-1 rounded-xl bg-q-panel p-3 text-lg">
                <div>اكتبوا <b className="text-q-gold">1</b> = جاوب</div>
                <div>اكتبوا <b className="text-q-cyan">2</b> = {L.withStreamer}</div>
                {state.variant === 'triple' && <div>اكتبوا <b className="text-q-purple">3</b> = اعكس على الستريمر</div>}
              </div>
              <div className="mb-2 text-xs text-white/60">🔒 اختيار الستريمر مخفي — لازم تكتبون «دخول» عشان تلعبون</div>
              <div className="mb-2 text-sm text-white/70">✅ جاوب: {answerers} · {L.icon} {L.verb}: {swappers}</div>
              {left !== null && <div className="mb-3 text-3xl font-black tabular-nums text-q-cyan">⏱ {left}</div>}
              <button type="button" className="q-btn-gold" onClick={() => act({ type: 'show' })}>اعرض الخيارات الآن</button>
            </div>
          )}

          {state.phase === 'steal' && (
            <div className="text-center">
              <div className="mb-1 text-5xl">💸</div>
              <div className="mb-1 text-xl font-black text-q-green">🔒 ما أحد لقى المفتاح!</div>
              <div className="mb-4 text-sm text-white/70">اختر واحد من المشاركين وخذ كل نقاطه</div>
              <div className="flex max-h-72 flex-wrap justify-center gap-2 overflow-auto">
                {state.joined
                  .filter((k) => (state.scores[k] ?? 0) > 0)
                  .sort((a, b) => (state.scores[b] ?? 0) - (state.scores[a] ?? 0))
                  .map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => act({ type: 'steal', user: k })}
                      className="rounded-xl border-2 border-q-line bg-q-panel px-3 py-2 text-sm font-black transition-all hover:-translate-y-0.5 hover:border-q-red hover:shadow-[0_0_18px_-6px_rgba(231,76,60,0.7)]"
                    >
                      {state.names[k] ?? k} · <bdi dir="ltr" className="text-q-gold">{state.scores[k]}</bdi>
                    </button>
                  ))}
              </div>
            </div>
          )}

          {(state.phase === 'answer' || state.phase === 'result') && q && r && (
            <div>
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="rounded-full bg-q-gold/15 px-3 py-1 font-black text-q-gold">{q.points} نقطة{q.categoryName ? ` · ${q.categoryName}` : ''}</span>
                {state.phase === 'answer' && left !== null && <span className="font-black tabular-nums text-q-cyan">⏱ {left}</span>}
              </div>
              {state.variant === 'hide' ? (
                <div>
                  <div className="mb-3 text-center text-xl font-black">{result ? '🔑 هنا كان المفتاح' : `🔎 الشات يخمّن… (المفتاح في ${q.correctIndex + 1})`}</div>
                  {r.shuffle ? (
                    <ShuffleBoxes shuffle={r.shuffle} startAt={r.shuffleAt ?? 0} hostNow={Date.now} reveal={Boolean(result)} />
                  ) : (
                    <HideBoxes keyAt={q.correctIndex} revealed={Boolean(result)} />
                  )}
                </div>
              ) : (
                <>
                <QuestionImage url={result && q.revealUrl ? q.revealUrl : q.imageUrl} type={q.type ?? 'text'} revealed={Boolean(result)} large />
                <AboutBadge q={q} />
                <div className="mb-4 text-center text-2xl font-black leading-snug">{q.text}</div>
                {q.faces ? (
                  <FaceGrid q={q} answerAt={r.answerAt} now={now} correct={result ? result.correctIndex : null} mine={r.streamer?.pick ?? null} />
                ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {q.options.map((o, i) => {
                    const right = result && i === result.correctIndex;
                    const streamerPicked = result && result.streamerPick === i;
                    return (
                      <div key={i} className={cn('flex items-center gap-2 rounded-xl border-2 p-3 text-start text-lg font-black', right ? 'border-q-green bg-q-green/15' : streamerPicked ? 'border-q-red bg-q-red/15' : 'border-q-line bg-q-panel')}>
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-q-gold/15 text-q-gold">{i + 1}</span>
                        {o}
                      </div>
                    );
                  })}
                </div>
                )}
                </>
              )}
              {state.phase === 'answer' && (
                <div className="mt-3 text-center text-sm text-white/70">
                  {state.variant === 'hide' ? (
                    <>اكتبوا رقم الصندوق (1-10) · خمّن {answered}</>
                  ) : (
                    <>اكتبوا رقم {q.faces ? 'الشخص (1-8)' : 'الخيار (1-4)'} أو <b>جاوب</b> + الجواب · أجاب {answered} · {L.verb} {swappers} · 🔒 اختيار الستريمر مخفي</>
                  )}
                  <div><button type="button" className="q-btn-gold mt-3" onClick={() => act({ type: 'finish' })}>أنهِ السؤال وأظهر الجواب</button></div>
                </div>
              )}
            </div>
          )}

          {state.phase === 'result' && result && (
            <div className="mt-4 text-center">
              {state.variant === 'hide' ? (
                <div className={cn('mb-1 text-xl font-black', result.streamerCorrect ? 'text-q-green' : 'text-q-red')}>
                  {result.stolen
                    ? `💸 أخذت ${result.stolen.points} نقطة من ${state.names[result.stolen.from] ?? result.stolen.from} (+${q?.points ?? 0} لأن ما أحد لقاه)`
                    : result.streamerCorrect
                    ? `🔒 ما أحد لقى المفتاح — لك ${q?.points ?? 0} نقطة`
                    : `🔓 لقاه ${Object.values(result.rows).filter((x) => x.outcome === 'answer-right').length} من الشات`}
                </div>
              ) : state.variant === 'triple' ? (
                <div className="mb-1 space-y-1">
                  {tripleLines(state, true).map((l, i) => (
                    <div key={i} className={cn(i === 0 ? 'text-xl font-black' : 'text-sm font-bold', toneClass[l.tone])}>{l.text}</div>
                  ))}
                </div>
              ) : (
              <div className={cn('mb-1 text-xl font-black', result.streamerCorrect ? 'text-q-green' : 'text-q-red')}>
                {result.streamerChoice === 'swap' ? `${L.icon} ${L.did} ${state.variant === 'flip' ? 'على' : 'مع'} ${state.names[result.streamerPartner ?? ''] ?? ''}` : 'جاوب'} — {result.streamerPick === null ? '⏱ بدون جواب' : result.streamerCorrect ? '✅ صح' : '❌ غلط'}
                {swappers > 0 && result.streamerChoice === 'answer' && (
                  <span className="block text-sm text-white/70">
                    {state.variant === 'flip' ? `${swappers} قلبوا عليك — ${result.streamerCorrect ? 'نقصت نقاطك' : 'زادت نقاطك'}` : result.streamerCorrect ? `😵 انزرفت! ${swappers} بادلوا معك وأخذوا جوابك الصح (دبل) — ما لك شي` : `المبادلون معك (${swappers}) خسروا النقاط`}
                  </span>
                )}
                {result.streamerChoice === 'swap' && state.variant !== 'flip' && (
                  <span className="block text-sm text-white/70">
                    {result.streamerCorrect ? `جاوب صح — لك دبل النقاط، و${state.names[result.streamerPartner ?? ''] ?? ''} انزرف 😵 ما ياخذ شي` : 'جاوب غلط — تنقص نقاطك'}
                  </span>
                )}
              </div>
              )}
              <button type="button" className="q-btn-gold mt-2" onClick={() => set(toBoard(state))}>{state.variant === 'hide' ? 'الجولة التالية ◀' : 'اللوحة ◀'}</button>
            </div>
          )}

          {state.phase === 'over' && (
            <div className="py-4">
              <Podium rows={rows} />
              <button type="button" className="q-btn-gold mt-6" onClick={playAgain}>
                🔁 العب مرة ثانية
              </button>
            </div>
          )}
          {error && <div className="mt-2 text-center text-sm text-q-red">{error}</div>}
        </div>

        {(state.phase !== 'lobby' || test) && (
          <div className="flex flex-col gap-3">
            <div className="q-card">
              <div className="mb-2 text-sm font-black text-q-gold">{state.phase === 'result' ? 'أفضل 10 بعد هذا السؤال' : 'أفضل 10'}</div>
              <ol className="space-y-1.5 text-sm">
                {top.map((row, i) => {
                  const o = state.phase === 'result' && row.outcome ? outcomeLabel(state.variant, row.outcome) : null;
                  return (
                    <li key={row.key}>
                      <div className="flex justify-between gap-2">
                        <span className="truncate">{i + 1}. {row.name}{row.streamer ? ' 🎙️' : ''}{row.run > 0 && <span className="ms-1 text-[10px]" title="إجابات صح ورا بعض">{'🔥'.repeat(row.run)}</span>}</span>
                        <bdi dir="ltr" className="font-black tabular-nums">{row.score}</bdi>
                      </div>
                      {o && (
                        <div className={cn('text-[11px]', o.cls)}>
                          {o.label}{row.streak && <b className="text-q-orange"> 🔥 دبل</b>}{row.first && <b className="text-q-gold"> ⚡ أول واحد — دبل</b>} <bdi dir="ltr">{row.delta > 0 ? `+${row.delta}` : row.delta}</bdi>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
              <p className="mt-3 text-[11px] leading-relaxed text-white/40">للمشاركة اكتب «دخول» في الشات.</p>
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
            <div className="q-card">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-black text-q-cyan">👥 المشاركون</span>
                <span className="rounded-full bg-q-cyan/15 px-2 py-0.5 text-xs font-black text-q-cyan">{state.joined.length}</span>
              </div>
              {state.joined.length === 0 ? (
                <p className="text-xs text-white/50">اكتبوا «دخول» في الشات عشان تشاركون</p>
              ) : (
                <div className="flex max-h-64 flex-wrap gap-1.5 overflow-auto">
                  {state.joined.map((k) => (
                    <span key={k} className="flex items-center gap-1 rounded-lg border border-q-line bg-q-panel py-1 ps-2 pe-1 text-xs font-black">
                      {state.names[k] ?? k}
                      <KickButton onKick={() => set(kickPlayer(ref.current ?? state, k))} name={state.names[k] ?? k} />
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** ✕ beside a player's name; a second tap within 3 seconds kicks them (so a slip of the finger doesn't). */
function KickButton({ onKick, name }: { onKick: () => void; name: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      title={`طرد ${name}`}
      className={cn('rounded-md px-1.5 leading-5 transition', armed ? 'bg-q-red text-white' : 'text-white/40 hover:bg-q-red/20 hover:text-q-red')}
      onClick={() => (armed ? onKick() : setArmed(true))}
    >
      {armed ? 'طرد؟' : '✕'}
    </button>
  );
}
