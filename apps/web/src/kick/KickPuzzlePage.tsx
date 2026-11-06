import {
  applyChat,
  connectKickChat,
  cellName,
  isDone,
  leaderboard,
  newPuzzle,
  PUZZLE_SIZES,
  trayLabels,
  KICK_CHANNEL_RE,
  type KickClientToServerEvents,
  type KickServerToClientEvents,
  type KickStatus,
  type PuzzleEvent,
  type PuzzleState,
} from '@quiz/shared';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { io, type Socket } from 'socket.io-client';
import { SERVER_URL } from '@/lib/server';
import { cn } from '@/lib/utils';

type KickSocket = Socket<KickServerToClientEvents, KickClientToServerEvents>;
type FeedItem = { id: number; text: string; tone: 'ok' | 'bad' | 'info' };

/** Center-crops the picked image to a square so the grid slices line up. */
async function cropSquare(file: File, side = 900): Promise<string> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = side;
  canvas.getContext('2d')!.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, side, side);
  bmp.close();
  return canvas.toDataURL('image/jpeg', 0.88);
}

function pieceStyle(url: string, size: number, piece: number): CSSProperties {
  const row = Math.floor(piece / size);
  const col = piece % size;
  return {
    backgroundImage: `url(${url})`,
    backgroundSize: `${size * 100}% ${size * 100}%`,
    backgroundPosition: `${(col * 100) / (size - 1)}% ${(row * 100) / (size - 1)}%`,
  };
}

function describe(e: PuzzleEvent, size: number): FeedItem['text'] | null {
  switch (e.type) {
    case 'join':
      return `👋 ${e.user} دخل اللعبة`;
    case 'place':
      return e.ok ? `✅ ${e.user} ركّب القطعة ${e.label} في ${e.cell}` : `❌ ${e.user}: القطعة ${e.label} مو في ${e.cell}`;
    case 'done':
      return `🏆 اكتملت الصورة! الفائز: ${e.winner ?? '—'}`;
    default:
      return null;
  }
}

export function KickPuzzlePage() {
  const [stage, setStage] = useState<'setup' | 'play'>('setup');
  const [channel, setChannel] = useState('');
  const [chatroom, setChatroom] = useState('');
  const [size, setSize] = useState<number>(4);
  const [image, setImage] = useState<string | null>(null);
  const [test, setTest] = useState(false);
  const [error, setError] = useState('');
  const [puzzle, setPuzzle] = useState<PuzzleState>(() => newPuzzle(4));
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [status, setStatus] = useState<KickStatus>({ state: 'connecting' });
  const stateRef = useRef(puzzle);
  const feedId = useRef(0);

  const push = useCallback((events: PuzzleEvent[]) => {
    const items = events.flatMap((e): FeedItem[] => {
      const text = describe(e, stateRef.current.size);
      if (!text) return [];
      return [{ id: ++feedId.current, text, tone: e.type === 'place' ? (e.ok ? 'ok' : 'bad') : 'info' }];
    });
    if (items.length) setFeed((f) => [...items.reverse(), ...f].slice(0, 9));
  }, []);

  const onChat = useCallback(
    (user: string, text: string) => {
      const { state, events } = applyChat(stateRef.current, user, text);
      if (state !== stateRef.current) {
        stateRef.current = state;
        setPuzzle(state);
      }
      push(events);
    },
    [push],
  );

  useEffect(() => {
    if (stage !== 'play' || test) return;
    const id = Number(chatroom) || undefined;
    // With a chat-room number the browser reads Kick's chat itself (Kick sees a normal viewer, not our server).
    if (id) return connectKickChat({ chatroomId: id, onStatus: setStatus, onMessage: (m) => onChat(m.user, m.text) });
    const socket: KickSocket = io(`${SERVER_URL}/kick`);
    const watch = () =>
      socket.emit('kick:watch', { channel: channel.trim(), chatroomId: id }, (res) => {
        if (!res.ok) setStatus({ state: 'error', detail: res.error });
      });
    socket.on('connect', watch);
    socket.on('kick:status', setStatus);
    socket.on('kick:message', (m) => onChat(m.user, m.text));
    socket.on('connect_error', () => setStatus({ state: 'error', detail: 'تعذّر الاتصال بالسيرفر' }));
    return () => {
      socket.disconnect();
    };
  }, [stage, test, channel, chatroom, onChat]);

  async function pickImage(file: File | undefined) {
    if (!file) return;
    try {
      setImage(await cropSquare(file));
      setError('');
    } catch {
      setError('تعذّر قراءة الصورة، جرّب صورة ثانية');
    }
  }

  function start(testMode: boolean) {
    if (!image) return setError('اختر صورة أول');
    if (!testMode && !KICK_CHANNEL_RE.test(channel.trim())) return setError('اكتب اسم قناتك في Kick (حروف إنجليزية وأرقام)');
    const fresh = newPuzzle(size);
    stateRef.current = fresh;
    setPuzzle(fresh);
    setFeed([]);
    setStatus({ state: 'connecting' });
    setTest(testMode);
    setError('');
    setStage('play');
  }

  if (stage === 'setup') {
    return (
      <div className="min-h-dvh bg-q-bg px-4 py-8 font-sans text-white" dir="rtl">
        <div className="mx-auto max-w-md">
          <h1 className="mb-1 text-center text-2xl font-black text-q-gold">🧩 لوحة الصورة — بث Kick</h1>
          <p className="mb-5 text-center text-xs text-white/50">المشاهدين يكتبون «دخول» في الشات ويرتّبون قطع الصورة مكانها الصحيح</p>
          <div className="q-card">
            <label className="mb-1 block text-xs text-white/60">اسم قناتك في Kick</label>
            <input className="q-input mb-3" dir="ltr" value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="streamer_name" />
            <label className="mb-1 block text-xs text-white/60">الصورة (تنقص لمربع)</label>
            <input type="file" accept="image/*" className="mb-3 block w-full text-xs" onChange={(e) => void pickImage(e.target.files?.[0])} />
            {image && <img src={image} alt="" className="mx-auto mb-3 size-32 rounded-lg object-cover" />}
            <label className="mb-1 block text-xs text-white/60">عدد القطع</label>
            <div className="mb-3 grid grid-cols-3 gap-2">
              {PUZZLE_SIZES.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSize(n)}
                  className={cn('rounded-xl border-2 py-2 text-sm font-black', size === n ? 'border-q-gold bg-q-gold/8' : 'border-q-line bg-q-panel')}
                >
                  {n}×{n}
                </button>
              ))}
            </div>
            <details className="mb-3 text-xs text-white/50">
              <summary className="cursor-pointer">متقدم: رقم الشات (إذا ما اشتغل الاتصال)</summary>
              <p className="my-1.5 leading-relaxed">افتح في المتصفح kick.com/api/v2/channels/اسم_قناتك وابحث عن chatroom ثم id والصق الرقم هنا.</p>
              <input className="q-input" dir="ltr" inputMode="numeric" value={chatroom} onChange={(e) => setChatroom(e.target.value.replace(/\D/g, ''))} placeholder="123456" />
            </details>
            {error && <div className="mb-2 text-center text-sm text-q-red">{error}</div>}
            <button type="button" className="q-btn-gold" onClick={() => start(false)}>
              🔴 ابدأ البث
            </button>
            <button type="button" className="mt-2 w-full text-xs text-white/50 underline" onClick={() => start(true)}>
              تجربة بدون Kick (تكتب الرسائل بنفسك)
            </button>
          </div>
        </div>
      </div>
    );
  }

  const n = puzzle.size;
  const tray = trayLabels(puzzle);
  const done = isDone(puzzle);
  const top = leaderboard(puzzle);
  const dot = status.state === 'live' ? 'bg-q-green' : status.state === 'error' ? 'bg-q-red' : 'bg-q-gold';

  return (
    <div className="min-h-dvh bg-q-bg p-3 font-sans text-white" dir="rtl">
      <div className="mx-auto mb-2 flex max-w-5xl flex-wrap items-center justify-between gap-2 text-xs">
        <div className="text-white/70">
          اكتب في الشات <b className="text-q-gold">دخول</b> ثم <b className="text-q-gold">رقم القطعة + المكان</b> مثل: <bdi dir="ltr" className="font-black text-q-cyan">5 B3</bdi>
        </div>
        <div className="flex items-center gap-2">
          {test ? (
            <span className="rounded-full border border-q-line px-2.5 py-1">🧪 وضع التجربة</span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full border border-q-line px-2.5 py-1">
              <span className={cn('size-2 rounded-full', dot)} />
              {status.state === 'live' ? `متصل بشات ${channel}` : status.detail ?? 'جاري الاتصال...'}
            </span>
          )}
          <button type="button" className="rounded-full border border-q-line px-2.5 py-1 text-white/60" onClick={() => setStage('setup')}>
            ← رجوع
          </button>
        </div>
      </div>

      <div className="mx-auto grid max-w-5xl gap-3 md:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <div className="mx-auto w-full max-w-[min(100%,78dvh)]">
            <div className="grid" dir="ltr" style={{ gridTemplateColumns: `1.2rem repeat(${n}, 1fr)` }}>
              <div />
              {Array.from({ length: n }, (_, c) => (
                <div key={c} className="pb-0.5 text-center text-xs font-black text-q-gold">
                  {String.fromCharCode(65 + c)}
                </div>
              ))}
              {Array.from({ length: n }, (_, r) => (
                <div key={r} className="contents">
                  <div className="flex items-center justify-center text-xs font-black text-q-gold">{r + 1}</div>
                  {Array.from({ length: n }, (_, c) => {
                    const cell = r * n + c;
                    const by = puzzle.placed[cell];
                    return (
                      <div
                        key={c}
                        className={cn('relative aspect-square border border-white/10', by ? 'animate-pop-in' : 'bg-q-panel/60')}
                        style={by && image ? pieceStyle(image, n, cell) : undefined}
                        title={by ? `${cellName(n, cell)} — ${by}` : cellName(n, cell)}
                      >
                        {!by && <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white/20">{cellName(n, cell)}</span>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid content-start gap-3">
          <div className="q-card !p-3">
            <div className="mb-1.5 text-xs font-bold text-q-gold">🧩 القطع المتبقية ({tray.length})</div>
            <div className="grid grid-cols-5 gap-1.5">
              {tray.map((label) => (
                <div key={label} className="relative aspect-square rounded border border-white/20" style={image ? pieceStyle(image, n, puzzle.labels.indexOf(label)) : undefined}>
                  <span className="absolute start-0.5 top-0.5 rounded bg-black/70 px-1 text-[11px] leading-tight font-black">{label}</span>
                </div>
              ))}
              {tray.length === 0 && <div className="col-span-5 text-center text-xs text-white/40">كلها في مكانها 🎉</div>}
            </div>
          </div>
          <div className="q-card !p-3">
            <div className="mb-1.5 text-xs font-bold text-q-gold">🏅 المتصدرين ({top.length} لاعب)</div>
            {top.length === 0 ? (
              <div className="text-xs text-white/40">أول واحد يكتب «دخول»...</div>
            ) : (
              top.slice(0, 8).map((p, i) => (
                <div key={p.name} className="flex justify-between py-0.5 text-sm">
                  <span className="truncate">
                    {i + 1}. {p.name}
                  </span>
                  <b className="text-q-gold tabular-nums">{p.score}</b>
                </div>
              ))
            )}
          </div>
          <div className="q-card !p-3">
            {feed.length === 0 && <div className="text-xs text-white/40">ما صار شي للحين</div>}
            {feed.map((f) => (
              <div key={f.id} className={cn('py-0.5 text-xs', f.tone === 'ok' && 'text-q-green', f.tone === 'bad' && 'text-q-red', f.tone === 'info' && 'text-white/80')}>
                {f.text}
              </div>
            ))}
          </div>
          {test && <TestBox onSend={onChat} />}
        </div>
      </div>

      {done && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="max-h-[90dvh] w-full max-w-sm animate-pop-in overflow-auto rounded-2xl border border-q-line bg-q-panel p-5 text-center">
            <div className="mb-1 text-5xl">🏆</div>
            <h2 className="mb-1 text-xl font-black">اكتملت الصورة!</h2>
            <p className="mb-3 text-sm text-q-gold">الفائز: {top[0]?.name ?? '—'}</p>
            {image && <img src={image} alt="" className="mx-auto mb-3 size-44 rounded-xl object-cover" />}
            <button type="button" className="q-btn-gold" onClick={() => start(test)}>
              🔄 لعبة جديدة
            </button>
            <button type="button" className="mt-2 w-full text-xs text-white/50 underline" onClick={() => setStage('setup')}>
              تغيير الصورة
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Test mode: type what a viewer would write in the chat. */
function TestBox({ onSend }: { onSend: (user: string, text: string) => void }) {
  const [user, setUser] = useState('مشاهد1');
  const [text, setText] = useState('');
  return (
    <form
      className="q-card !p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) onSend(user.trim() || 'مشاهد', text);
        setText('');
      }}
    >
      <div className="mb-1.5 text-xs font-bold text-q-cyan">🧪 رسالة تجريبية</div>
      <input className="q-input mb-1.5" value={user} onChange={(e) => setUser(e.target.value)} aria-label="اسم المشاهد" />
      <input className="q-input mb-1.5" dir="ltr" value={text} onChange={(e) => setText(e.target.value)} placeholder="دخول  /  5 B3" aria-label="الرسالة" />
      <button className="q-btn-gold">إرسال</button>
    </form>
  );
}
