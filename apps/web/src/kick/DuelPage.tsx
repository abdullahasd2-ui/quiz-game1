import {
  DUEL_ANSWER_CHOICES,
  DUEL_DEFAULTS,
  DUEL_GOAL_CHOICES,
  DUEL_HP_CHOICES,
  DUEL_MODES,
  DUEL_RESULT_MS,
  DUEL_ROUND_CHOICES,
  DUEL_WIN_CHOICES,
  KICK_CHANNEL_RE,
  POINTS,
  duelCaptain,
  duelChat,
  duelDeal,
  duelFinish,
  duelPublicView,
  duelStop,
  duelTick,
  newDuel,
  teamSize,
  type DuelClientToServerEvents,
  type DuelQuestion,
  type DuelServerToClientEvents,
  type DuelSettings,
  type DuelState,
  type DuelTeam,
  type KickStatus,
  type PublicCategory,
} from '@quiz/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { api } from '@/lib/api';
import { SERVER_URL } from '@/lib/server';
import { cn } from '@/lib/utils';
import { Background3D } from '@/game/fx/Background3D';
import { DuelArena, TEAM } from './DuelParts';
import { useKickChat } from './useKickChat';

const randomId = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
const MAX_CATEGORIES = 8;

async function fetchQuestion(category: number, points: number): Promise<DuelQuestion> {
  const res = await fetch(`${SERVER_URL}/api/kick/question?category=${category}&points=${points}`);
  if (!res.ok) throw new Error('تعذّر جلب سؤال');
  return (await res.json()) as DuelQuestion;
}

/** «تحدي القنوات»: the host streamer's private page. Both channels' chats are read here; the game is published to the broadcast. */
export function DuelPage() {
  const [channelA, setChannelA] = useState('');
  const [channelB, setChannelB] = useState('');
  const [test, setTest] = useState(false);
  /** «بث واحد»: one channel, its chat split in two (the streamer picks the red captain). */
  const [single, setSingle] = useState(false);
  const [settings, setSettings] = useState<DuelSettings>(DUEL_DEFAULTS);
  const [cats, setCats] = useState<PublicCategory[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [state, setState] = useState<DuelState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sync] = useState(() => ({ code: randomId(8), key: randomId(24) }));
  const used = useRef(new Set<string>());

  useEffect(() => {
    api.publicCategories().then((c) => setCats(c.filter((x) => x.playable))).catch(() => setError('تعذّر تحميل الفئات'));
  }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  // Time runs out on the host's page (the broadcast only shows it).
  useEffect(() => {
    setState((s) => (s ? duelTick(s, now) : s));
  }, [now]);

  const on = Boolean(state) && !test;
  const chat = useCallback((team: DuelTeam, user: string, text: string) => setState((s) => (s ? duelChat(s, team, user, text, Date.now()) : s)), []);
  const statusA = useKickChat(state?.channels.a ?? '', on, useCallback((u: string, t: string) => chat('a', u, t), [chat]));
  // In «بث واحد» the red team is in the same chat (channels.b is then the captain's name, not a channel).
  const statusB = useKickChat(state?.single ? '' : (state?.channels.b ?? ''), on, useCallback((u: string, t: string) => chat('b', u, t), [chat]));

  // Publish to the broadcast page on every change and every few seconds (a late-opened screen catches up).
  const latest = useRef<DuelState | null>(null);
  latest.current = state;
  const publishNow = useRef<() => void>(() => {});
  useEffect(() => {
    const sock: Socket<DuelServerToClientEvents, DuelClientToServerEvents> = io(`${SERVER_URL}/duel-sync`);
    const publish = () => {
      if (!sock.connected) return;
      const st = latest.current;
      sock.emit('duel:publish', { code: sync.code, hostKey: sync.key, state: st ? duelPublicView(st) : null, hostNow: Date.now() }, () => {});
    };
    sock.on('connect', publish);
    const beat = setInterval(publish, 3000);
    publishNow.current = publish;
    return () => {
      clearInterval(beat);
      sock.disconnect();
    };
  }, [sync]);
  useEffect(() => publishNow.current(), [state]);

  const screenUrl = `${window.location.origin}/kick/duel/screen?code=${sync.code}`;
  const validA = test || KICK_CHANNEL_RE.test(channelA.trim());
  const validB = test || single || KICK_CHANNEL_RE.test(channelB.trim());
  const set = <K extends keyof DuelSettings>(k: K, v: DuelSettings[K]) => setSettings((x) => ({ ...x, [k]: v }));

  function open() {
    setError('');
    if (!validA || !validB) return setError(single ? 'اكتب اسم قناتك مثل ما يطلع في رابطها: kick.com/الاسم' : 'اكتب اسم القناتين مثل ما يطلع في رابطها: kick.com/الاسم');
    if (!test && !single && channelA.trim().toLowerCase() === channelB.trim().toLowerCase()) return setError('القناتين لازم يكونون مختلفين');
    if (picked.length < 2) return setError('اختر فئتين على الأقل');
    used.current.clear();
    const a = test ? channelA.trim() || 'قناتك' : channelA.trim();
    setState(newDuel({ a, b: single ? '' : test ? channelB.trim() || 'الخصم' : channelB.trim() }, settings, randomId(8), test, single));
  }

  async function next() {
    if (!state || loading) return;
    setLoading(true);
    setError('');
    try {
      // A question not played yet in this duel (a few tries).
      let q: DuelQuestion | null = null;
      for (let i = 0; i < 4 && !q; i++) {
        const cat = picked[Math.floor(Math.random() * picked.length)]!;
        const points = state.settings.mode === 'faza' ? 200 : POINTS[Math.floor(Math.random() * POINTS.length)]!;
        const got = await fetchQuestion(cat, points).catch(() => null);
        if (got && (!used.current.has(got.text) || i === 3)) q = got;
      }
      if (!q) throw new Error('تعذّر جلب سؤال — جرّب مرة ثانية');
      used.current.add(q.text);
      setState((s) => (s ? duelDeal(s, q!, Date.now()) : s));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر جلب سؤال');
    } finally {
      setLoading(false);
    }
  }

  const resultAt = state?.phase === 'result' ? state.round?.endsAt ?? 0 : 0;
  const canNext = state && (state.phase === 'lobby' || (state.phase === 'result' && now - resultAt > DUEL_RESULT_MS));
  const ready = state && (state.single ? Boolean(state.captain) && teamSize(state, 'a') > 0 : state.test || (teamSize(state, 'a') > 0 && teamSize(state, 'b') > 0));

  return (
    <div className="relative isolate min-h-dvh bg-q-bg text-white" dir="rtl">
      <div className="q-aurora" aria-hidden />
      <Background3D />
      <main className="relative mx-auto max-w-5xl px-4 py-6">
        <div className="mb-5 flex items-center justify-between gap-2">
          <a href="/kick/quiz" className="text-sm text-white/60 hover:text-white">
            → صفحة البث
          </a>
          <h1 className="q-display text-3xl">
            ⚔️ <span className="bg-linear-to-l from-sky-300 to-rose-300 bg-clip-text text-transparent">تحدي القنوات</span>
          </h1>
          <span className="w-20" />
        </div>

        {!state && (
          <div className="space-y-4">
            <p className="text-center text-sm text-white/70">ستريمرين، وكل شات فريق. متابعين قناتك ضد متابعين قناة الخصم، والنقاط بالنسبة عشان القناة الصغيرة تقدر تفوز.</p>

            <section className="grid grid-cols-2 gap-2 rounded-3xl border border-white/10 bg-q-panel/60 p-1.5">
              {(
                [
                  [false, '📡📡 بثين', 'قناتك ضد قناة ستريمر ثاني، وكل شات فريق'],
                  [true, '📡 بث واحد', 'شاتك ينقسم فريقين: أزرق معك، وأحمر مع رئيس تختاره من الشات'],
                ] as const
              ).map(([id, title, desc]) => (
                <button
                  key={title}
                  type="button"
                  onClick={() => setSingle(id)}
                  aria-pressed={single === id}
                  className={cn('rounded-2xl px-3 py-2.5 text-start transition', single === id ? 'bg-q-gold/15 ring-2 ring-q-gold' : 'hover:bg-white/5')}
                >
                  <div className="font-black">{title}</div>
                  <div className="text-xs leading-relaxed text-white/65">{desc}</div>
                </button>
              ))}
            </section>

            <section className={cn('grid gap-3', !single && 'sm:grid-cols-2')}>
              {(single ? (['a'] as const) : (['a', 'b'] as const)).map((t) => (
                <label key={t} className={cn('block rounded-3xl border-2 bg-linear-to-b p-4', TEAM[t].ring, TEAM[t].bg)}>
                  <div className={cn('mb-2 font-black', TEAM[t].text)}>{t === 'a' ? (single ? '📡 قناتك' : '🔵 قناتك (المضيف)') : '🔴 قناة الخصم'}</div>
                  <input
                    dir="ltr"
                    value={t === 'a' ? channelA : channelB}
                    onChange={(e) => (t === 'a' ? setChannelA : setChannelB)(e.target.value)}
                    placeholder="kick channel name"
                    className="w-full rounded-xl border border-white/15 bg-q-bg/70 px-3 py-2 font-bold outline-none focus:border-q-gold"
                  />
                </label>
              ))}
            </section>

            <section>
              <h2 className="mb-2 text-sm font-black text-q-gold">اختر الطور</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {DUEL_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => set('mode', m.id)}
                    className={cn('rounded-3xl border-2 p-4 text-start transition', settings.mode === m.id ? 'border-q-gold bg-q-gold/10 shadow-[0_0_40px_-12px_rgba(247,201,72,0.8)]' : 'border-white/10 bg-q-panel/70 hover:border-white/30')}
                  >
                    <div className="text-4xl">{m.emoji}</div>
                    <div className="q-display mt-1 text-2xl">{m.title}</div>
                    <div className="mt-1 text-xs leading-relaxed text-white/70">{m.short}</div>
                  </button>
                ))}
              </div>
            </section>

            <section className="grid gap-3 rounded-3xl border border-white/10 bg-q-panel/60 p-4 sm:grid-cols-2">
              <Choice label="⏱️ وقت الإجابة" value={settings.answerMs / 1000} options={DUEL_ANSWER_CHOICES} unit="ث" onPick={(v) => set('answerMs', v * 1000)} />
              {settings.mode === 'castle' && <Choice label="❤️ حياة كل قلعة" value={settings.castleHp} options={DUEL_HP_CHOICES} onPick={(v) => set('castleHp', v)} />}
              {settings.mode === 'faza' && (
                <>
                  <Choice label="🏁 الفوز بعد" value={settings.fazaWins} options={DUEL_WIN_CHOICES} unit="جولات" onPick={(v) => set('fazaWins', v)} />
                  <Choice label="🎯 هدف الجولة (من لاعبي الفريق)" value={settings.fazaGoalPct} options={DUEL_GOAL_CHOICES} unit="٪" onPick={(v) => set('fazaGoalPct', v)} />
                </>
              )}
              {settings.mode === 'chain' && <Choice label="🔗 عدد الأسئلة" value={settings.chainRounds} options={DUEL_ROUND_CHOICES} onPick={(v) => set('chainRounds', v)} />}
            </section>

            <section>
              <h2 className="mb-2 text-sm font-black text-q-gold">الفئات (فئتين على الأقل)</h2>
              <div className="flex flex-wrap gap-2">
                {cats.map((c) => {
                  const on = picked.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setPicked((p) => (on ? p.filter((x) => x !== c.id) : p.length >= MAX_CATEGORIES ? p : [...p, c.id]))}
                      className={cn('rounded-full border-2 px-3 py-1.5 text-sm font-black', on ? 'border-q-gold bg-q-gold/15' : 'border-white/10 bg-q-panel/70')}
                    >
                      {c.icon} {c.name}
                    </button>
                  );
                })}
              </div>
            </section>

            <label className="flex items-center gap-2 text-sm text-white/70">
              <input type="checkbox" checked={test} onChange={(e) => setTest(e.target.checked)} /> 🧪 تجربة بدون Kick (تكتب رسائل الشات بنفسك)
            </label>
            {error && <p className="text-center text-sm font-bold text-q-red">{error}</p>}
            <button type="button" onClick={open} className="q-btn-gold w-full text-lg">
              افتح التحدي ⚔️
            </button>
          </div>
        )}

        {state && (
          <div className="space-y-4">
            <div className="rounded-3xl border border-q-cyan/30 bg-q-cyan/5 p-3">
              <div className="mb-1 text-sm font-black text-q-cyan">📺 رابط شاشة البث — حطه في OBS{state.single ? '' : '، وأرسله للستريمر الثاني يحطه عنده'}</div>
              <div className="flex gap-2">
                <input readOnly dir="ltr" value={screenUrl} className="min-w-0 flex-1 rounded-xl border border-white/15 bg-q-bg/70 px-3 py-2 text-xs" onFocus={(e) => e.target.select()} />
                <button
                  type="button"
                  className="rounded-xl bg-q-cyan/20 px-3 text-sm font-black"
                  onClick={() => void navigator.clipboard.writeText(screenUrl).then(() => (setCopied(true), setTimeout(() => setCopied(false), 1500)))}
                >
                  {copied ? '✓ نُسخ' : 'نسخ الرابط'}
                </button>
              </div>
              {!state.test && (
                <div className={cn('mt-2 grid gap-2 text-xs', !state.single && 'grid-cols-2')}>
                  <ChatStatus t="a" name={state.channels.a} st={statusA} />
                  {!state.single && <ChatStatus t="b" name={state.channels.b} st={statusB} />}
                </div>
              )}
            </div>

            {state.single && state.phase === 'lobby' && <CaptainPicker s={state} onPick={(u) => setState((s) => (s ? duelCaptain(s, u) : s))} />}

            <DuelArena s={state} now={now} />

            {state.test && <TestChat onLine={chat} />}

            {error && <p className="text-center text-sm font-bold text-q-red">{error}</p>}
            <div className="flex flex-wrap justify-center gap-2">
              {state.phase === 'lobby' && (
                <button type="button" disabled={!ready || loading} onClick={() => void next()} className="q-btn-gold px-8 text-lg disabled:opacity-50">
                  {ready ? 'ابدأ التحدي — أول سؤال ▶' : state.single ? (state.captain ? 'ننتظر لاعب في الفريق الأزرق…' : 'اختر رئيس الفريق الأحمر أول 👑') : 'ننتظر لاعب من كل شات…'}
                </button>
              )}
              {state.phase === 'question' && (
                <button type="button" onClick={() => setState((s) => (s ? duelStop(s, Date.now()) : s))} className="rounded-2xl border-2 border-white/20 px-6 py-2 font-black">
                  أنهِ السؤال الحين ⏹
                </button>
              )}
              {state.phase === 'result' && (
                <button type="button" disabled={!canNext || loading} onClick={() => void next()} className="q-btn-gold px-8 text-lg disabled:opacity-50">
                  {loading ? '…' : 'السؤال التالي ▶'}
                </button>
              )}
              {state.phase !== 'over' && state.phase !== 'lobby' && (
                <button type="button" onClick={() => setState((s) => (s ? duelFinish(s) : s))} className="rounded-2xl border-2 border-q-red/40 px-5 py-2 text-sm font-black text-q-red">
                  إنهاء التحدي وإعلان الفايز
                </button>
              )}
              {(state.phase === 'over' || state.phase === 'lobby') && (
                <button type="button" onClick={() => setState(null)} className="rounded-2xl border-2 border-white/20 px-5 py-2 text-sm font-black">
                  {state.phase === 'over' ? 'تحدي جديد 🔁' : 'رجوع للإعدادات'}
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Choice<T extends number>({ label, value, options, unit, onPick }: { label: string; value: number; options: readonly T[]; unit?: string; onPick: (v: T) => void }) {
  return (
    <div>
      <div className="mb-1 text-xs font-black text-white/70">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button key={o} type="button" onClick={() => onPick(o)} className={cn('rounded-xl border-2 px-3 py-1 text-sm font-black', value === o ? 'border-q-gold bg-q-gold/15' : 'border-white/10')}>
            {o}
            {unit ? ` ${unit}` : ''}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatStatus({ t, name, st }: { t: DuelTeam; name: string; st: KickStatus | null }) {
  const live = st?.state === 'live';
  return (
    <div className={cn('rounded-xl border px-2 py-1', TEAM[t].ring)}>
      <span className={cn('font-black', TEAM[t].text)} dir="ltr">
        {name}
      </span>{' '}
      {live ? <span className="text-q-green">🟢 متصل بالشات</span> : st?.state === 'error' ? <span className="text-q-red">🔴 {st.detail ?? 'تعذّر الاتصال'}</span> : <span className="text-white/60">⏳ {st?.detail ?? 'جاري الاتصال...'}</span>}
    </div>
  );
}

/** «بث واحد»: the streamer taps one of the chat to make them the red team's captain. */
function CaptainPicker({ s, onPick }: { s: DuelState; onPick: (user: string) => void }) {
  const players = Object.values(s.players).sort((x, y) => x.name.localeCompare(y.name));
  return (
    <div className="rounded-3xl border-2 border-rose-400/40 bg-rose-500/5 p-3">
      <div className="mb-1 font-black text-rose-200">👑 اختر رئيس الفريق الأحمر من الشات</div>
      <p className="mb-2 text-xs leading-relaxed text-white/65">
        اللي يكتب «أزرق» يلعب معك، واللي يكتب «أحمر» يلعب مع الرئيس. اضغط على اسم أي واحد دخل عشان يصير رئيس الأحمر، والفريق الأحمر ياخذ اسمه.
        {s.captain ? '' : ' لازم تختار رئيس قبل ما تبدأ.'}
      </p>
      {players.length === 0 ? (
        <div className="text-xs text-white/45">ما أحد دخل للحين…</div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {players.map((p) => {
            const chief = s.captain?.toLowerCase() === p.name.toLowerCase();
            return (
              <button
                key={`${p.team}:${p.name}`}
                type="button"
                onClick={() => onPick(p.name)}
                className={cn('rounded-full border-2 px-3 py-1 text-sm font-black transition', chief ? 'border-q-gold bg-q-gold/20' : p.team === 'a' ? 'border-sky-400/40 text-sky-200' : 'border-rose-400/40 text-rose-200')}
              >
                {chief ? '👑 ' : p.team === 'a' ? '🔵 ' : '🔴 '}
                {p.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Test mode: the streamer types chat lines for either team («فهد: دخول»). */
function TestChat({ onLine }: { onLine: (t: DuelTeam, user: string, text: string) => void }) {
  const [team, setTeam] = useState<DuelTeam>('a');
  const [line, setLine] = useState('');
  const send = () => {
    const m = line.match(/^\s*([^:]+):\s*(.+)$/);
    if (!m) return;
    onLine(team, m[1]!.trim(), m[2]!.trim());
    setLine('');
  };
  return (
    <div className="flex gap-2 rounded-2xl border border-dashed border-white/20 p-2">
      <button type="button" onClick={() => setTeam((t) => (t === 'a' ? 'b' : 'a'))} className={cn('rounded-xl px-3 text-sm font-black', TEAM[team].chip)}>
        {team === 'a' ? '🔵 شات قناتك' : '🔴 شات الخصم'}
      </button>
      <input
        value={line}
        onChange={(e) => setLine(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && send()}
        placeholder="فهد: دخول"
        className="min-w-0 flex-1 rounded-xl border border-white/15 bg-q-bg/70 px-3 py-1.5 text-sm"
      />
      <button type="button" onClick={send} className="rounded-xl bg-white/10 px-3 text-sm font-black">
        أرسل
      </button>
    </div>
  );
}
