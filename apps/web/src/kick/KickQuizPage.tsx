import './stream.css';
import {
  chatMessage,
  kickPlayer,
  judgeUnknown,
  deal,
  finish,
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
  kickSlugs,
  connectKickChat,
  kickPusherUrl,
  type KickPusher,
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
import { LetterGrid, ListLive, ListResult, UnknownAnswers, usedLetters } from './ListParts';
import { QuizHowToButton, QuizHowToModal } from './QuizHowTo';
import { ModeHowPill } from '@/game/screens/HomeScreen';
import { VideoGuideButton } from './VideoGuide';
import { findChatroom } from './useKickChat';
import { HotBadge, usePopular } from '@/game/popular';
import { StreamQuick } from '@/quick/StreamQuick';
import { useCardSpotlight } from '@/lib/spotlight';
import { CornerTools, HotkeysHelp, Kbd, useHotkeys, useWakeLock, type HotkeyRow } from '@/lib/hotkeys';

/** Each stream mode's own colours on the setup screen (same family as the home page's mode cards). */
const STREAM_MODE_BG: Record<StreamVariant, string> = {
  swap: 'from-[#0c3b5e] to-[#0a1a3a]',
  flip: 'from-[#3b0f5e] to-[#1a0a3a]',
  triple: 'from-[#5e3b0c] to-[#2a1a08]',
  hide: 'from-[#0c5e3b] to-[#08281a]',
  list: 'from-[#5e0c3b] to-[#2a0818]',
};

const PHASE_NAME: Record<StreamState['phase'], string> = {
  lobby: 'تجهيز اللعبة',
  board: 'اختيار السؤال',
  streamer: 'دورك تجاوب',
  choose: 'الشات يختار',
  shuffle: 'خلط الصناديق',
  answer: 'وقت الإجابة',
  steal: 'خذ نقاط مشارك',
  result: 'النتيجة',
  over: 'انتهت اللعبة',
};

/**
 * The streamer's control bar during a game, stuck to the top: phase, question count, players, answers so far, time
 * left, and the phase's main action (it presses the page's own button, the same one Enter presses).
 */
function ControlDock({ phase, counter, joined, answered, left, go }: { phase: string; counter: string; joined: number; answered: number | null; left: number | null; go: string | null }) {
  const stat = 'flex items-center gap-1 rounded-lg bg-black/25 px-2 py-1 text-xs font-bold whitespace-nowrap';
  return (
    <div className="q-glass sticky top-2 z-30 flex flex-wrap items-center gap-2 px-3 py-2 lg:col-span-2" role="region" aria-label="لوحة التحكم">
      <span className="flex items-center gap-1.5 text-sm font-black">
        <span className="size-2 rounded-full bg-q-green motion-safe:animate-pulse" aria-hidden />
        {phase}
      </span>
      <span className={stat}>🎯 {counter}</span>
      <span className={stat}>👥 {joined}</span>
      {answered !== null && <span className={cn(stat, 'text-q-cyan')}>✍️ {answered} جاوبوا</span>}
      {left !== null && <span className={cn(stat, 'q-display text-base tabular-nums', left <= 5 ? 'text-q-red' : 'text-q-gold')}>⏱ {left}</span>}
      {go && (
        <button
          type="button"
          onClick={() => document.querySelector<HTMLButtonElement>('main [data-hotkey="go"], [data-hotkey="go"]')?.click()}
          className="ms-auto flex items-center gap-1.5 rounded-xl bg-linear-to-l from-q-orange to-q-gold px-3.5 py-1.5 text-sm font-black text-black shadow-[0_6px_18px_-8px_rgba(255,107,53,0.8)] hover:-translate-y-0.5"
        >
          {go} ◀<Kbd k="Enter" className="border-black/20 bg-black/10 text-black/60" />
        </button>
      )}
    </div>
  );
}

const LINK_KEY = 'jab:kick:linked';
/** The linked Kick channel: the one Kick's login just returned (kept for next time), or the one kept last time. */
function rememberedLink(fresh: string | null): string {
  try {
    if (fresh) {
      localStorage.setItem(LINK_KEY, fresh);
      return fresh;
    }
    return localStorage.getItem(LINK_KEY) ?? '';
  } catch {
    return fresh ?? '';
  }
}

const STREAM_KEYS: HotkeyRow[] = [
  ['Enter / Space', 'الزر الرئيسي: ابدأ اللعبة، السؤال التالي، اعرض الخيارات، أنهِ السؤال، التالي'],
  ['1 / 2 / 3 / 4', 'جوابك على السؤال، أو اختيار فئة السؤال في «عدّها»'],
  ['1 … 9 / 0', 'اختيار الصندوق في «خبّي أو اكشف» (0 = الصندوق العاشر)'],
  ['ا … ي', 'اختيار الحرف في فئة «حروف» (اكتب الحرف على لوحة المفاتيح العربية)'],
  ['R', 'حرف عشوائي في فئة «حروف»'],
  ['Esc', 'الرجوع من شبكة الحروف إلى الفئات'],
];

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
  list: { label: '✍️ عدّ', cls: 'text-q-green' },
  reversed: { label: '↩️ انعكس عليه — ما ياخذ نقاط السؤال', cls: 'text-q-gold' },
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
  // A linked Kick account is remembered on this device (fresh from Kick's login, or from last time) until «تسجيل خروج».
  const [linked, setLinked] = useState(() => rememberedLink(params.get('linked')));
  const [canLink, setCanLink] = useState(false);
  const [channel, setChannel] = useState(linked);
  const [cats, setCats] = useState<PublicCategory[]>([]);
  const [chosen, setChosen] = useState<number[]>([]);
  const [test, setTest] = useState(false);
  const [answerSec, setAnswerSec] = useState<number>(30);
  const [hideRounds, setHideRounds] = useState(10);
  // A team's private pack (by code): its questions stay here on the control page, in the order of play.
  const [packCode, setPackCode] = useState('');
  const [pack, setPack] = useState<QuestionPack | null>(null);
  /** «عدّها»: its categories (from the server) and the ones picked. */
  const [listCats, setListCats] = useState<{ id: string; name: string; icon: string; count: number }[]>([]);
  const hotStream = usePopular()?.streamVariants[0];
  /** «عدّها» difficulty: any of سهل/متوسط/صعب (at least one). */
  const [listLevels, setListLevels] = useState<string[]>(['easy', 'medium']);
  const [listChosen, setListChosen] = useState<string[]>(['football', 'geo', 'general', 'games', 'islamic', 'proverbs']);
  const deck = useRef<PackQuestion[]>([]);
  const [variant, setVariant] = useState<StreamVariant>('swap');
  const [modeHow, setModeHow] = useState(false);
  const [error, setError] = useState(params.get('kick_error') ?? '');
  const [state, setState] = useState<StreamState | null>(null);
  const [status, setStatus] = useState<KickStatus>({ state: 'connecting' });
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  /** «حروف»: questions left per letter, for the letter grid on the board. */
  const [letterCounts, setLetterCounts] = useState<Record<string, number> | null>(null);
  /** «عدّها» board: the streamer picked «حروف» and is now choosing a letter. */
  const [pickingLetter, setPickingLetter] = useState(false);
  const { help, setHelp } = useHotkeys();
  useCardSpotlight();
  // The streamer's laptop must not sleep in the middle of a game.
  useWakeLock(Boolean(state && state.phase !== 'lobby' && state.phase !== 'over'));
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
    let gone = false;
    let stopBrowser: (() => void) | null = null;
    let socket: KickSocket | null = null;
    const slugs = kickSlugs(channel);

    // Through our server: a linked account (Kick's webhook), or when the browser could not read the chat itself.
    const viaServer = (hit: { slug: string; id: number } | null, browserWhy?: string) => {
      if (gone || socket) return;
      socket = io(`${SERVER_URL}/kick`);
      socket.on('connect', () =>
        socket!.emit('kick:watch', { channel: hit?.slug ?? slugs[0] ?? channel.trim(), chatroomId: hit?.id, official: Boolean(linked) || undefined }, (res) => {
          if (!res.ok) setStatus({ state: 'error', detail: res.error });
        }),
      );
      // Keep what the browser's own attempt ran into next to the server's status (to see why a channel fails).
      socket.on('kick:status', (st) => setStatus(browserWhy && st.state !== 'live' ? { ...st, detail: `${st.detail ?? ''} · محاولة المتصفح: ${browserWhy}` } : st));
      socket.on('kick:message', (m) => onChat(m.user, m.text));
      socket.on('connect_error', () => setStatus({ state: 'error', detail: 'تعذّر الاتصال بالسيرفر' }));
    };

    if (linked) viaServer(null);
    else {
      // By name only (no Kick login): Kick often blocks servers, but not a viewer's browser. So the browser finds
      // the channel and reads its chat itself, like kick.com does; the server is only the fallback.
      setStatus({ state: 'connecting', detail: 'جاري البحث عن القناة...' });
      void findChatroom(slugs).then(async (hit) => {
        if (gone) return;
        if (!hit) return viaServer(null);
        let live = false;
        // Kick's current chat-feed key, from our server (Kick rotates it); the built-in one if that fails.
        const pusher = await fetch(`${SERVER_URL}/api/kick/pusher`, { signal: AbortSignal.timeout(8000) })
          .then((r) => (r.ok ? (r.json() as Promise<KickPusher>) : undefined))
          .catch(() => undefined);
        if (gone) return;
        stopBrowser = connectKickChat({
          chatroomId: hit.id,
          url: kickPusherUrl(pusher),
          handshakeMs: 10000,
          maxRetries: 3,
          onMessage: (m) => onChat(m.user, m.text),
          onStatus: (st) => {
            if (gone) return;
            if (st.state === 'live') live = true;
            if (st.state === 'error' && !live) {
              // The browser could not read it either: let the server try.
              stopBrowser?.();
              stopBrowser = null;
              return viaServer(hit, st.detail);
            }
            setStatus(st);
          },
        });
      });
    }
    return () => {
      gone = true;
      stopBrowser?.();
      socket?.disconnect();
    };
  }, [playing, test, channel, linked, onChat]);

  /**
   * Logs the linked Kick account out of this page: the link only lives in the address (?linked=…, set after Kick's
   * login), so it is dropped from there too and a refresh does not bring it back. The streamer can link again or type
   * a channel name. (Kick keeps the app's access until it is removed in Kick's own settings.)
   */
  function unlink() {
    setLinked('');
    setChannel('');
    try {
      localStorage.removeItem(LINK_KEY);
    } catch {
      // Private mode: nothing was kept.
    }
    setError('');
    const url = new URL(window.location.href);
    url.searchParams.delete('linked');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  }

  function start(testMode: boolean) {
    // «@name», a kick.com link or the name itself; the shown name drops the link and the @.
    const typed = channel.trim().replace(/^https?:\/\/(www\.)?kick\.com\//i, '').replace(/^(www\.)?kick\.com\//i, '').replace(/^@/, '').split(/[/?#\s]/)[0] ?? '';
    const name = typed || 'الستريمر';
    if (!testMode && !kickSlugs(channel).length) return setError('اكتب اسم قناتك في Kick مثل ما يطلع في رابطها (حروف إنجليزية وأرقام)');
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
      if (variant === 'hide' || variant === 'list') setVariant('swap');
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

  useEffect(() => {
    if (variant !== 'list' || listCats.length) return;
    void fetch(`${SERVER_URL}/api/kick/lists/categories`)
      .then((r) => r.json())
      .then((c: typeof listCats) => setListCats(c))
      .catch(() => setError('تعذّر تحميل فئات «عدّها»'));
  }, [variant, listCats.length]);

  // «حروف»: on the board, how many questions each letter still has.
  const boardUsed = state?.phase === 'board' && state.variant === 'list' ? state.used.join(',') : null;
  useEffect(() => {
    if (boardUsed === null || !pickingLetter) return;
    let gone = false;
    void fetch(`${SERVER_URL}/api/kick/lists/letters`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ levels: listLevels, exclude: boardUsed ? boardUsed.split(',').map((u) => u.replace(/^list:/, '')) : [] }),
    })
      .then((r) => r.json())
      .then((rows: { letter: string; count: number }[]) => !gone && setLetterCounts(Object.fromEntries(rows.map((x) => [x.letter, x.count]))))
      .catch(() => !gone && setError('تعذّر تحميل الحروف'));
    return () => {
      gone = true;
    };
  }, [boardUsed, pickingLetter, listLevels]);

  /** «عدّها»: the next question from the server, never one already played this game. */
  async function dealList(letter?: string, only?: string) {
    const cur = ref.current;
    if (!cur || busy || cur.phase !== 'board') return;
    if (cur.used.length >= cur.totalCells) return set(finish(cur));
    setBusy(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/kick/lists/next`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cats: only ? [only] : listChosen, levels: listLevels, exclude: cur.used.map((u) => u.replace(/^list:/, '')), ...(letter ? { letter } : {}) }),
      });
      if (!res.ok) throw new Error(letter ? `خلصت أسئلة حرف «${letter}»` : 'خلصت الأسئلة في هذي الفئات');
      const q = (await res.json()) as { id: string; cat: string; text: string; answers: string[]; letter?: string };
      const cat = listCats.find((c) => c.id === q.cat);
      setPickingLetter(false);
      if (ref.current) set(deal(ref.current, `list:${q.id}`, { text: q.text, options: [], correctIndex: -1, points: 1, imageUrl: null, listAnswers: q.answers, listLetter: q.letter, categoryName: cat ? `${cat.icon} ${cat.name}` : undefined }, Date.now()));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطأ');
    } finally {
      setBusy(false);
    }
  }

  function beginGame() {
    if (!ref.current) return;
    if (variant === 'list') {
      if (!listChosen.length) return setError('اختر فئة وحدة على الأقل');
      if (!listLevels.length) return setError('اختر مستوى صعوبة واحد على الأقل');
      setError('');
      set(toBoard({ ...ref.current, totalCells: hideRounds, answerMs: answerSec * 1000, board: undefined, variant, pack: undefined }));
      return;
    }
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

  const toggleCat = (id: number) => setChosen((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < MAX_CATEGORIES ? [...cur, id] : cur));
  const toggleList = (id: string) => setListChosen((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const quick = (
    <StreamQuick
      state={state}
      start={start}
      variant={variant}
      setVariant={setVariant}
      hasPack={Boolean(pack)}
      cats={cats}
      chosen={chosen}
      toggleCat={toggleCat}
      listCats={listCats}
      listChosen={listChosen}
      toggleList={toggleList}
      answerSec={answerSec}
      setAnswerSec={setAnswerSec}
      rounds={hideRounds}
      setRounds={setHideRounds}
      beginGame={beginGame}
      finishGame={() => ref.current && set(finish(ref.current))}
      screenUrl={state ? `${location.origin}/kick/quiz/screen?code=${syncCode}` : null}
      onKeys={() => setHelp(true)}
    />
  );

  if (!state) {
    return (
      <div className="min-h-dvh bg-q-bg px-4 py-8 font-sans text-white relative isolate" dir="rtl">
        <div className="q-aurora" aria-hidden />
        <Background3D />
        {quick}
        <div className="mx-auto max-w-md">
          <h1 className="q-display flex items-center justify-center gap-2.5 text-6xl leading-tight">
            <Logo />
            <span className="bg-linear-to-l from-q-purple to-q-pink bg-clip-text text-transparent">جاوب</span>
            <span className="text-3xl text-white/70">أو</span>
            <span className="bg-linear-to-l from-q-cyan to-[#7dd3fc] bg-clip-text text-transparent">بادل</span>
          </h1>
          <div className="mb-2 flex justify-center">
            <span dir="ltr" className="inline-flex items-center gap-1.5 rounded-lg bg-[#53FC18] px-3 py-0.5 text-sm font-black tracking-[0.2em] text-black shadow-[0_0_22px_-4px_#53FC18]">
              <span className="size-2 rounded-full bg-black motion-safe:animate-pulse" />
              KICK
            </span>
          </div>
          <p className="mb-2 text-center text-xs text-white/50">المشاهدون يكتبون «دخول» عشان يلعبون، وكل لاعب نقاطه لحاله</p>
          <div className="mb-5 flex flex-wrap items-center justify-center gap-2">
            <QuizHowToButton forStreamer fancy />
            <VideoGuideButton />
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
                <button
                  type="button"
                  onClick={unlink}
                  className="ms-2 rounded-lg border border-white/15 px-2.5 py-1 text-xs font-bold text-white/70 transition-colors hover:border-q-red/60 hover:bg-q-red/10 hover:text-q-red"
                >
                  🚪 تسجيل خروج
                </button>
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
    <div className="min-h-dvh bg-q-bg p-3 pb-28 font-sans text-white relative isolate" dir="rtl">
      <div className="q-aurora" aria-hidden />
      <Background3D />
      {quick}
      <HotkeysHelp open={help} onClose={() => setHelp(false)} rows={STREAM_KEYS} title="اختصارات الستريمر" />
      <div className="mx-auto mb-2 flex max-w-5xl items-center justify-between text-xs">
        <span className="flex items-center gap-2 text-white/70">{state.phase === 'lobby' ? 'قبل بداية اللعبة' : `اللعب: ${state.used.length} من ${state.totalCells} ${state.variant === 'hide' ? 'جولة' : 'سؤال'}${state.pack ? ` · ${state.pack.name}` : ''}`} <QuizHowToButton forStreamer pack={Boolean(state.pack)} variant={state.phase === 'lobby' ? undefined : (state.variant ?? 'swap')} className="px-2.5 py-0.5 text-[11px]" /> <VideoGuideButton label="🎬 الشرح" className="px-2.5 py-0.5 text-[11px]" /> <CornerTools onHelp={() => setHelp(true)} className="[&_button]:size-7 [&_button]:text-sm" /></span>
        <span className="flex items-center gap-2">
          {test ? '🧪 وضع التجربة' : <><span className={cn('size-2 rounded-full', dot)} />{status.state === 'live' ? 'متصل بالشات' : status.detail ?? 'جاري الاتصال...'}</>}
        </span>
      </div>
      <div id="st-room" className="mx-auto mb-2 max-w-5xl rounded-xl border border-q-line bg-q-panel px-3 py-2 text-xs text-white/70">
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
      <div className={cn('mx-auto grid max-w-5xl gap-3', state.phase === 'lobby' && !test ? 'max-w-2xl' : 'lg:grid-cols-[1fr_17rem]')}>
        {state.phase !== 'lobby' && state.phase !== 'over' && (
          <ControlDock
            phase={PHASE_NAME[state.phase]}
            counter={`${state.variant === 'hide' ? 'الجولة' : 'السؤال'} ${Math.min(state.used.length + (state.phase === 'board' ? 1 : 0), state.totalCells)} من ${state.totalCells}`}
            joined={state.joined.length}
            answered={state.phase === 'answer' ? (state.variant === 'list' ? Object.keys(r?.list?.found ?? {}).length : answered) : null}
            left={left}
            go={
              state.phase === 'choose'
                ? 'اعرض الخيارات'
                : state.phase === 'answer'
                  ? 'أنهِ السؤال'
                  : state.phase === 'result'
                    ? 'التالي'
                    : state.phase === 'board' && (state.pack || state.variant === 'hide')
                      ? state.variant === 'hide' ? 'ابدأ الجولة' : 'السؤال التالي'
                      : null
            }
          />
        )}
        <div className="q-card">
          {state.phase === 'lobby' && (
            <div className="space-y-5">
              <div id="st-joined" className="q-glass p-5 text-center">
                <div className="text-xl font-black">
                  اكتبوا <b className="rounded-lg bg-q-gold px-2 text-black">دخول</b> في الشات للمشاركة في اللعبة
                </div>
                <div className="mt-3 flex items-center justify-center gap-3">
                  <span className="text-sm text-white/70">👥 المشاركون</span>
                  <span key={state.joined.length} className="q-display min-w-14 rounded-2xl bg-q-cyan/15 px-3 py-0.5 text-4xl text-q-cyan tabular-nums motion-safe:animate-fx-bump">
                    {state.joined.length}
                  </span>
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

              <div id="st-pack" className="rounded-xl border border-q-line bg-q-panel p-3">
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
                    <input id="st-pack-code" className="q-input flex-1" dir="ltr" value={packCode} onChange={(e) => setPackCode(e.target.value)} placeholder="CODE-XXXX" />
                    <button type="button" className="rounded-xl border-2 border-q-line px-3 text-sm font-black" onClick={() => void loadPack()}>
                      تحميل
                    </button>
                  </div>
                )}
              </div>

              <div>
                <div className="mb-2 text-sm font-black">🎮 اختر الطور</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {(pack ? (['swap', 'flip', 'triple'] as const) : (['swap', 'flip', 'triple', 'hide', 'list'] as const)).map((v) => {
                    const l = streamLabels(v);
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setVariant(v)}
                        aria-pressed={variant === v}
                        className={cn(
                          'q-spot relative overflow-hidden rounded-2xl bg-linear-to-br p-3 text-center transition-all',
                          STREAM_MODE_BG[v],
                          variant === v ? 'scale-[1.02] ring-2 ring-q-gold ring-offset-2 ring-offset-q-bg' : 'opacity-75 ring-1 ring-white/10 hover:-translate-y-0.5 hover:opacity-100',
                        )}
                      >
                        {hotStream === v && <HotBadge className="top-1.5 inset-x-0 mx-auto w-fit px-2.5 py-0.5 text-[11px] ring-2 ring-white/50 motion-safe:animate-none" />}
                        <div className={cn('text-3xl', hotStream === v && 'mt-5', variant === v && 'motion-safe:animate-float-y')}>{l.icon}</div>
                        <div className="q-display text-xl text-white">{l.title}</div>
                        {variant === v && (
                          <div className="my-1.5 flex justify-center">
                            <ModeHowPill onOpen={() => setModeHow(true)} />
                          </div>
                        )}
                        <div className="mt-0.5 text-[11px] text-white/60">
                          {v === 'swap' ? 'تبادل مع الستريمر: إذا جواب الستريمر صح تاخذ دبل النقاط، وإذا جواب الستريمر غلط تنقص نقاطك' : v === 'flip' ? 'تقلب على الستريمر: إذا جواب الستريمر صح تنقص نقاطه، وإذا جواب الستريمر غلط تزيد نقاطه' : v === 'triple' ? 'بادل: إذا جواب الستريمر صح تاخذ دبل، وإذا جواب الستريمر غلط تنقص نقاطك · اعكس: إذا جواب الستريمر صح تنقص نقاطك، وإذا جواب الستريمر غلط تزيد نقاطك' : v === 'list' ? 'سؤال واحد والشات يكتب أكثر عدد أجوبة: كل جواب صح نقطة، والأول +5 والثاني +3 والثالث +2' : 'تخبّي المفتاح في صندوق والشات يخمّن رقم الصندوق من 1 إلى 10'}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <QuizHowToModal open={modeHow} onClose={() => setModeHow(false)} forStreamer variant={variant} pack={Boolean(pack)} title={`📖 طريقة لعب «${streamLabels(variant).title}»`} />
              </div>

              {/* «تحدي القنوات» is its own game (its own page), so it sits apart from the modes above. */}
              <div className="relative">
                <div className="mb-2 flex items-center gap-2 text-xs font-black text-white/50">
                  <span className="h-px flex-1 bg-white/10" />
                  أو العب ضد شات ثاني
                  <span className="h-px flex-1 bg-white/10" />
                </div>
                <a
                  href="/kick/duel"
                  className="group flex items-center gap-3 rounded-2xl border-2 border-white/15 bg-linear-to-l from-sky-600/30 via-q-panel to-rose-600/30 p-3 shadow-[0_10px_30px_-12px_rgba(168,85,247,0.7)] transition-transform hover:-translate-y-0.5"
                >
                  <span className="text-4xl transition-transform group-hover:scale-110">⚔️</span>
                  <span className="flex-1 text-start leading-tight">
                    <span className="block text-lg font-black text-white">
                      تحدي القنوات <span className="ms-1 rounded-full bg-q-gold px-1.5 text-[10px] text-black">جديد</span>
                    </span>
                    <span className="mt-0.5 block text-[11px] font-bold text-white/65">بثين ضد بعض، أو شاتك ينقسم فريقين · 🏰 القلعة · ⚡ الفزعة · ⛓️ السلسلة</span>
                  </span>
                  <span className="text-white/50 transition-transform group-hover:-translate-x-1">←</span>
                </a>
              </div>

              {pack ? null : variant === 'list' ? (
                <div className="space-y-4">
                  <div>
                    <div className="mb-2 text-sm font-black">🗂️ الفئات</div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {listCats.map((c) => {
                        const on = listChosen.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setListChosen((cur) => (on ? cur.filter((x) => x !== c.id) : [...cur, c.id]))}
                            className={cn('rounded-xl border-2 px-2 py-2 text-sm font-black transition-all', on ? 'border-q-gold bg-q-gold/8 shadow-[0_0_18px_-6px_rgba(247,201,72,0.6)]' : 'border-q-line bg-q-panel')}
                          >
                            {c.icon} {c.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 text-sm font-black">🎯 مستوى الصعوبة <span className="text-[11px] font-bold text-white/50">(اختر واحد أو أكثر)</span></div>
                    <div className="grid grid-cols-2 gap-2">
                      {([['easy', '🟢', 'سهل', 'أجوبة كثيرة يعرفها الكل'], ['medium', '🟡', 'متوسط', 'تحتاج معرفة أكثر']] as const).map(([id, icon, name, hint]) => {
                        const on = listLevels.includes(id);
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setListLevels((cur) => (on ? cur.filter((x) => x !== id) : [...cur, id]))}
                            className={cn('rounded-xl border-2 px-2 py-2 text-center transition-all', on ? 'border-q-gold bg-q-gold/8 shadow-[0_0_18px_-6px_rgba(247,201,72,0.6)]' : 'border-q-line bg-q-panel opacity-60')}
                          >
                            <div className="text-sm font-black">{icon} {name}</div>
                            <div className="text-[10px] text-white/50">{hint}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 text-sm font-black">🔁 عدد الأسئلة</div>
                    <div className="grid grid-cols-4 gap-2">
                      {[5, 10, 15, 30].map((n) => (
                        <button key={n} type="button" onClick={() => setHideRounds(n)} className={cn('rounded-xl border-2 py-2 text-sm font-black', hideRounds === n ? 'border-q-gold bg-q-gold/8' : 'border-q-line bg-q-panel')}>
                          {n} أسئلة
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : variant === 'hide' ? (
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

              <button type="button" data-hotkey="go" className="q-btn-gold" onClick={beginGame}>
                ▶️ ابدأ اللعبة <Kbd k="Enter" />
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
              <button type="button" data-hotkey="go" className="q-btn-gold" onClick={dealPack}>
                ▶️ السؤال التالي <Kbd k="Enter" />
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
                data-hotkey="go"
                onClick={() => ref.current && set(deal(ref.current, `h:${ref.current.used.length + 1}`, hideQuestion(randomHidePoints()), Date.now()))}
              >
                🔑 ابدأ الجولة وخبّي المفتاح <Kbd k="Enter" />
              </button>
              <button type="button" className="mt-3 w-full text-xs text-white/50 underline" onClick={() => set(finish(state))}>إنهاء اللعبة وعرض الفائز</button>
            </div>
          )}

          {state.phase === 'board' && state.variant === 'list' && (
            <div className="py-4 text-center">
              <div className="mb-1 text-5xl">⏱️</div>
              <div className="mb-1 text-xl font-black">
                عدّها — السؤال {state.used.length + 1} من {state.totalCells}
              </div>
              <div className="mb-4 text-sm text-white/60">يطلع السؤال ويبدأ الوقت على طول ({Math.round((state.answerMs ?? 30000) / 1000)} ثانية)</div>
              {!pickingLetter ? (
                <div className="mb-2">
                  <div className="mb-2 text-sm font-black">🗂️ اختر فئة السؤال</div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {listCats
                      .filter((c) => listChosen.includes(c.id))
                      .map((c, i) => (
                        <button
                          key={c.id}
                          type="button"
                          data-hotkey={String(i + 1)}
                          disabled={busy}
                          onClick={() => (c.id === 'letters' ? setPickingLetter(true) : void dealList(undefined, c.id))}
                          className="rounded-xl border-2 border-q-line bg-q-panel px-2 py-3 text-base font-black transition-all hover:border-q-gold hover:bg-q-gold/8 disabled:opacity-50"
                        >
                          {c.icon} {c.name}
                          <Kbd k={String(i + 1)} />
                        </button>
                      ))}
                  </div>
                  {busy && <div className="mt-2 text-sm text-white/60">جاري جلب السؤال...</div>}
                </div>
              ) : (
                <div className="mb-2">
                  <div className="mb-2 text-sm font-black">🔤 اختر حرف — يتلوّن ويطلع سؤال يبدأ فيه</div>
                  <LetterGrid used={usedLetters(state.used)} counts={letterCounts ?? undefined} onPick={(l) => !busy && void dealList(l)} />
                  <button
                    type="button"
                    className="q-btn-gold mt-3"
                    data-hotkey="random"
                    disabled={busy || !letterCounts}
                    onClick={() => {
                      const ok = Object.entries(letterCounts ?? {}).filter(([, n]) => n > 0).map(([l]) => l);
                      const fresh = ok.filter((l) => !usedLetters(state.used).has(l));
                      const from = fresh.length ? fresh : ok;
                      if (from.length) void dealList(from[Math.floor(Math.random() * from.length)]);
                    }}
                  >
                    {busy ? 'جاري جلب السؤال...' : '🎲 حرف عشوائي'} <Kbd k="R" />
                  </button>
                  <button type="button" data-hotkey="back" className="mt-2 w-full text-sm text-white/60 underline" onClick={() => setPickingLetter(false)}>
                    ↩️ رجوع للفئات <Kbd k="Esc" />
                  </button>
                </div>
              )}
              <button type="button" className="mt-3 w-full text-xs text-white/50 underline" onClick={() => set(finish(state))}>إنهاء اللعبة وعرض الفائز</button>
            </div>
          )}

          {state.phase === 'board' && state.variant !== 'hide' && state.variant !== 'list' && !state.pack && (
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
                <span className="rounded-full bg-q-gold/15 px-3 py-1 font-black text-q-gold">{state.variant === 'list' ? 'كل جواب نقطة' : `${q.points} نقطة`}{q.categoryName ? ` · ${q.categoryName}` : ''}</span>
                <span className="text-xs text-white/60">دورك أول — اختيارك يبقى مخفي عن الشات</span>
              </div>
              <QuestionImage url={q.imageUrl} type={q.type ?? 'text'} large />
              <AboutBadge q={q} />
              <div key={q.text} className="kq-host-q mb-4 text-center text-2xl font-black leading-snug">{q.text}</div>
              <div className="mb-1 text-center text-xs text-white/60">جاوب: اضغط {q.faces ? 'الشخص' : 'الخيار'} اللي تبيه</div>
              {q.faces ? (
                <FaceGrid q={q} now={now} onPick={(i) => act({ type: 'answer', index: i })} />
              ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {q.options.map((o, i) => (
                  <button key={i} type="button" data-hotkey={String(i + 1)} onClick={() => act({ type: 'answer', index: i })} className="flex items-center gap-2 rounded-xl border-2 border-q-line bg-q-panel p-3 text-start text-lg font-black hover:border-q-gold">
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
              <div key={q.text} className="kq-host-q mb-3 text-2xl font-black leading-snug">{q.text}</div>
              <div className="mx-auto mb-2 max-w-sm space-y-1 rounded-xl bg-q-panel p-3 text-lg">
                <div>اكتبوا <b className="text-q-gold">1</b> = جاوب</div>
                <div>اكتبوا <b className="text-q-cyan">2</b> = {L.withStreamer}</div>
                {state.variant === 'triple' && <div>اكتبوا <b className="text-q-purple">3</b> = اعكس على الستريمر</div>}
              </div>
              <div className="mb-2 text-xs text-white/60">🔒 اختيار الستريمر مخفي — لازم تكتبون «دخول» عشان تلعبون</div>
              <div className="mb-2 text-sm text-white/70">✅ جاوب: {answerers} · {L.icon} {L.verb}: {swappers}</div>
              {left !== null && <div className="mb-3 text-3xl font-black tabular-nums text-q-cyan">⏱ {left}</div>}
              <button type="button" data-hotkey="go" className="q-btn-gold" onClick={() => act({ type: 'show' })}>اعرض الخيارات الآن <Kbd k="Enter" /></button>
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
                <span className="rounded-full bg-q-gold/15 px-3 py-1 font-black text-q-gold">{state.variant === 'list' ? 'كل جواب صح نقطة' : `${q.points} نقطة`}{q.categoryName ? ` · ${q.categoryName}` : ''}</span>
                {state.phase === 'answer' && left !== null && <span className="font-black tabular-nums text-q-cyan">⏱ {left}</span>}
              </div>
              {state.variant === 'list' ? (
                <div>
                  {q.listLetter && (
                    <div className="mb-3">
                      <LetterGrid active={q.listLetter} used={usedLetters(state.used)} small />
                    </div>
                  )}
                  <div key={q.text} className="kq-host-q mb-4 text-center text-2xl font-black leading-snug">{q.text}</div>
                  {state.phase === 'answer' ? <ListLive state={state} /> : <ListResult state={state} />}
                  <UnknownAnswers state={state} onJudge={(key, accept) => ref.current && set(judgeUnknown(ref.current, key, accept))} />
                </div>
              ) : state.variant === 'hide' ? (
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
                <div key={q.text} className="kq-host-q mb-4 text-center text-2xl font-black leading-snug">{q.text}</div>
                {q.faces ? (
                  <FaceGrid q={q} answerAt={r.answerAt} now={now} correct={result ? result.correctIndex : null} mine={r.streamer?.pick ?? null} />
                ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {q.options.map((o, i) => {
                    const right = result && i === result.correctIndex;
                    const streamerPicked = result && result.streamerPick === i;
                    return (
                      <div key={`${q.text}-${i}`} style={{ '--i': i } as React.CSSProperties} className={cn('kq-opt text-lg', right ? 'right' : streamerPicked ? 'ring-2 ring-q-red' : result && 'dim')}>
                        <span className="n">{i + 1}</span>
                        <span className="min-w-0 flex-1">{o}</span>
                      </div>
                    );
                  })}
                </div>
                )}
                </>
              )}
              {state.phase === 'answer' && (
                <div className="mt-3 text-center text-sm text-white/70">
                  {state.variant === 'list' ? (
                    <>اكتبوا أكبر عدد من الأجوبة — كل جواب صح نقطة · يقدر يكتب أكثر من جواب بينها فاصلة</>
                  ) : state.variant === 'hide' ? (
                    <>اكتبوا رقم الصندوق (1-10) · خمّن {answered}</>
                  ) : (
                    <>اكتبوا رقم {q.faces ? 'الشخص (1-8)' : 'الخيار (1-4)'} أو <b>جاوب</b> + الجواب · أجاب {answered} · {L.verb} {swappers} · 🔒 اختيار الستريمر مخفي</>
                  )}
                  <div><button type="button" data-hotkey="go" className="q-btn-gold mt-3" onClick={() => act({ type: 'finish' })}>أنهِ السؤال وأظهر الجواب <Kbd k="Enter" /></button></div>
                </div>
              )}
            </div>
          )}

          {state.phase === 'result' && result && (
            <div className="mt-4 text-center">
              {state.variant === 'list' ? null : state.variant === 'hide' ? (
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
              ) : result.rows[state.streamer]?.outcome === 'mutual' ? (
                <div className="mb-1 text-xl font-black text-q-gold">🤝 أنت و{state.names[result.streamerPartner ?? ''] ?? ''} اخترتوا بعض — الاثنين صفر</div>
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
              <button type="button" data-hotkey="go" className="q-btn-gold mt-2" onClick={() => set(toBoard(state))}>{state.variant === 'hide' ? 'الجولة التالية ◀' : state.variant === 'list' ? 'التالي ◀' : 'اللوحة ◀'} <Kbd k="Enter" /></button>
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
            <div id="st-top" className="q-card">
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
                      {o && state.variant === 'list' && (
                        <div className="text-[11px] text-q-green">
                          ✍️ {result?.rows[row.key]?.found ?? 0} جواب{result?.rows[row.key]?.bonus ? <b className="text-q-gold"> + بونص {result.rows[row.key]!.bonus}</b> : null} <bdi dir="ltr">+{row.delta}</bdi>
                        </div>
                      )}
                      {o && state.variant !== 'list' && (
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
            <div id="st-players" className="q-card">
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
