// «فردي»: every player on their own. One component per step, all fed by the solo room view.
// Swap / flip / reverse work like the streamer's swap on the stream: tap it, then pick the player from the list under it.
import { cellKey, LIST_BONUS, LIST_MAX_TEXT, POINTS, type Action, type SoloRow, type SoloView } from '@quiz/shared';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Kbd } from '@/lib/hotkeys';
import { shareInvite } from '@/lib/native';
import { PUBLIC_URL } from '@/lib/server';
import { QrCode } from '@/lib/QrCode';
import { cn } from '@/lib/utils';
import { LetterGrid } from '@/kick/ListParts';
import { send } from '../connection';
import { Confetti } from '../fx/Confetti';
import { play } from '../fx/sound';
import { actionInfo, actionLabel, Countdown, QuestionImage, Steps, WaitDots } from '../ui';
import { CategoryPicker, ListPicker } from './LobbyScreen';

const nameOf = (v: SoloView, id: string | null) => v.players.find((p) => p.id === id)?.name ?? '—';
const names = (v: SoloView, ids: string[]) => ids.map((id) => nameOf(v, id)).join(' و');

async function ack(p: Promise<{ ok: true } | { ok: false; error: string }>) {
  const res = await p;
  if (!res.ok) toast.error(res.error);
  return res.ok;
}

/** Every player's score, best first; the one in turn, you, and who already decided are marked. */
function Scores({ view, marks = false }: { view: SoloView; marks?: boolean }) {
  const rows = [...view.players].sort((a, b) => b.score - a.score);
  return (
    <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
      {rows.map((p, i) => (
        <div
          key={p.id}
          className={cn(
            'min-w-24 shrink-0 rounded-2xl border bg-q-panel/80 px-3 py-2 text-center backdrop-blur',
            p.id === view.you ? 'border-q-gold/60' : 'border-q-line',
            view.turn === p.id && view.phase === 'board' && 'ring-2 ring-q-gold',
            !p.connected && 'opacity-45',
          )}
        >
          <div className="flex items-center justify-center gap-1 truncate text-[11px] font-bold text-white/70">
            {i === 0 && p.score > 0 && <span aria-hidden>👑</span>}
            {!p.connected && <span title="غير متصل">📵</span>}
            <span className="truncate">{p.name}</span>
            {p.id === view.you && <span className="text-q-gold">(أنت)</span>}
          </div>
          <div key={p.score} dir="ltr" className="q-display text-2xl leading-tight tabular-nums text-q-gold motion-safe:animate-fx-bump">
            {p.score}
          </div>
          {marks && view.done.includes(p.id) ? (
            <div className="text-[10px] font-black text-q-green">✓ قرّر</div>
          ) : p.streak > 0 ? (
            <div className={cn('text-[10px] font-black', p.streak >= 2 ? 'text-q-orange' : 'text-white/55')}>
              {'🔥'.repeat(p.streak)}
              {p.streak >= 2 && ' الجاية دبل'}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// ── Lobby ────────────────────────────────────────────────────────────────

function SoloLobby({ view }: { view: SoloView }) {
  const isTv = view.mode === 'tv';
  const link = `${PUBLIC_URL}/?code=${view.code}&solo=1`;
  async function invite() {
    if (await shareInvite(link, `تعال العب معي جاوب أو بادل (فردي)! كود الغرفة: ${view.code}`)) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success('تم نسخ رابط الدعوة');
    } catch {
      toast.info(link);
    }
  }
  const ready = view.players.length >= 2;
  return (
    <div className="animate-fade-up">
      <Steps at={2} labels={['الطور', 'الغرفة', 'الفئات والبدء']} className="pt-2" />
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 pt-4 pb-2.5 text-center">
        <div>
          <div className="mb-1.5 text-[13px] font-bold text-q-cyan">🙋 فردي — كل واحد يلعب لحاله</div>
          <div className="mb-1.5 text-xs text-white/50">كود الغرفة — شاركه مع اللاعبين</div>
          <div className="my-1.5 inline-block rounded-2xl bg-linear-to-l from-q-orange to-q-gold px-6 py-3 text-[32px] font-black tracking-[0.3em] text-black" dir="ltr" data-testid="room-code">
            {view.code}
          </div>
          <div>
            <button type="button" onClick={invite} className="text-xs text-white/50 underline-offset-4 hover:text-q-gold hover:underline">
              🔗 نسخ رابط الدعوة
            </button>
          </div>
        </div>
        <QrCode text={link} label="📷 امسح وادخل" className={isTv ? 'w-40' : 'w-28'} />
      </div>

      <div className="q-card mb-3">
        <div className="mb-2 text-xs font-black text-white/70">اللاعبون ({view.players.length})</div>
        <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {view.players.map((p) => (
            <li key={p.id} className={cn('flex items-center justify-between gap-1 rounded-xl border border-q-line bg-q-bg/60 px-2.5 py-2 text-sm', !p.connected && 'opacity-45')}>
              <span className="truncate">
                {p.host ? '👑 ' : '🙋 '}
                {p.name}
                {p.id === view.you && <span className="text-q-gold"> (أنت)</span>}
              </span>
              {view.host && p.id !== view.you && (
                <button
                  type="button"
                  onClick={() => void ack(send('room:kick', { id: p.id }))}
                  aria-label={`طرد ${p.name}`}
                  className="shrink-0 rounded-full border border-q-red/40 px-1.5 text-[10px] text-q-red"
                >
                  طرد
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {view.host && ready ? (
        view.variant === 'list' ? (
          <ListPicker tv={isTv} solo />
        ) : (
          <CategoryPicker tv={isTv} variant={view.variant} />
        )
      ) : (
        <div className="p-4 text-center text-sm text-white/50">{!ready ? '⏳ في انتظار لاعب ثاني على الأقل...' : '⏳ في انتظار المضيف لبدء اللعبة...'}</div>
      )}
    </div>
  );
}

// ── Board ────────────────────────────────────────────────────────────────

const POINT_TONE: Record<number, string> = {
  100: 'text-q-green border-q-green/30',
  200: 'text-q-blue border-q-blue/30',
  300: 'text-q-gold border-q-gold/30',
  400: 'text-q-orange border-q-orange/30',
  500: 'text-q-red border-q-red/30',
};

function SoloBoard({ view }: { view: SoloView }) {
  const mine = view.turn === view.you;
  // The host may pick for a player who is away, so the game never waits on them.
  const turnAway = !view.players.find((p) => p.id === view.turn)?.connected;
  const mayPick = mine || (view.host && turnAway) || view.you === 'tv';
  const [pending, setPending] = useState<string | null>(null);
  async function pick(categoryId: number, points: number) {
    setPending(cellKey(categoryId, points));
    await ack(send('game:pick', { categoryId, points }));
    setPending(null);
  }
  return (
    <div className="animate-fade-up">
      <Scores view={view} />
      <div className="mb-2.5 text-center text-[13px] text-white/50">
        {mine ? (
          <>
            <b className="text-q-gold">دورك!</b> اختار سؤالاً
          </>
        ) : (
          <>
            دور <span className="font-bold text-q-gold">{nameOf(view, view.turn)}</span> في اختيار السؤال
          </>
        )}
      </div>
      <div className="-mx-1 overflow-x-auto pb-2">
        <table className="w-full min-w-max border-separate border-spacing-1.5">
          <thead>
            <tr>
              {view.categories.map((c) => (
                <th key={c.id} className="min-w-16 rounded-lg border border-q-line bg-linear-to-br from-[#1a1a40] to-[#2a1a50] px-1 py-2.5 text-xs font-bold text-q-gold">
                  <div className="text-lg">{c.icon}</div>
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {POINTS.map((pts) => (
              <tr key={pts}>
                {view.categories.map((c) => {
                  const key = cellKey(c.id, pts);
                  const used = view.used.includes(key);
                  return (
                    <td key={key} className="p-0.5">
                      <button
                        type="button"
                        disabled={used || !mayPick || pending !== null}
                        onClick={() => pick(c.id, pts)}
                        aria-label={`${c.name} ${pts}`}
                        className={cn(
                          'w-full rounded-lg border bg-q-panel px-1 py-3 text-[15px] font-black tabular-nums transition-transform',
                          POINT_TONE[pts],
                          used && 'border-transparent bg-[#1a1a2a] line-through opacity-35 grayscale',
                          !used && mayPick && 'hover:scale-105',
                          !used && !mayPick && 'cursor-default opacity-60',
                          pending === key && 'animate-pulse',
                        )}
                      >
                        {used ? '✅' : pts}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Question ─────────────────────────────────────────────────────────────

/** What happened to a player in the result, in a full sentence. */
function outcomeText(view: SoloView, row: SoloRow): string {
  const t = nameOf(view, row.target);
  const by = names(view, row.by);
  switch (row.outcome) {
    case 'answer-right':
      return row.streak ? 'جاوب صح — ثالث جواب صح ورا بعض، فالنقاط دبل 🔥' : 'جاوب صح';
    case 'answer-wrong':
      return 'جاوب غلط';
    case 'idle':
      return 'ما جاوب في الوقت';
    case 'robbed':
      return `انزرف! جاوب صح لكن ${by} بادل جوابه وأخذ النقاط`;
    case 'reversed':
      return `عكسه ${by}، فما ياخذ شي`;
    case 'flipped-right':
      return `قلبه ${by} وجوابه صح، فتنقص نقاطه`;
    case 'flipped-wrong':
      return `قلبه ${by} وجوابه غلط، فتزيد نقاطه`;
    case 'swap-win':
      return `بادل ${t} وجوابه صح، فأخذ النقاط دبل`;
    case 'swap-lose':
      return `بادل ${t} وجوابه غلط، فنقصت نقاطه`;
    case 'reverse-win':
      return `عكس ${t} وجوابه غلط، فزادت نقاطه`;
    case 'reverse-lose':
      return `عكس ${t} وجوابه صح، فنقصت نقاطه`;
    case 'flip':
      return `قلب ${t}`;
    case 'void':
      return `اختار ${t} لكن ${t} ما جاوب بنفسه، فما ياخذ شي`;
    case 'list':
      return `${row.found} جواب صح${row.bonus ? ` + بونص ${row.bonus}` : ''}`;
  }
}

function ResultList({ view }: { view: SoloView }) {
  const rows = view.result!.rows;
  const order = [...view.players].sort((a, b) => (rows[b.id]?.delta ?? 0) - (rows[a.id]?.delta ?? 0));
  return (
    <div className="q-card mb-3 grid gap-1.5">
      {order.map((p) => {
        const r = rows[p.id];
        if (!r) return null;
        return (
          <div key={p.id} className={cn('flex items-center gap-2 rounded-xl border px-3 py-2', p.id === view.you ? 'border-q-gold/50 bg-q-gold/6' : 'border-q-line bg-q-bg/50')}>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-black">{p.name}</div>
              <div className="text-[11px] leading-snug text-white/60">{outcomeText(view, r)}</div>
            </div>
            <div dir="ltr" className={cn('q-display text-xl tabular-nums', r.delta > 0 ? 'text-q-green' : r.delta < 0 ? 'text-q-red' : 'text-white/40')}>
              {r.delta > 0 ? `+${r.delta}` : r.delta}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NextButton({ view, last }: { view: SoloView; last: boolean }) {
  const [busy, setBusy] = useState(false);
  const hostHere = view.mode === 'tv' ? view.tvConnected : view.players.find((p) => p.host)?.connected;
  if (!view.host && hostHere)
    return (
      <div className="p-3 text-center text-xs text-white/50">
        <WaitDots /> في انتظار المضيف ينتقل للسؤال التالي…
      </div>
    );
  return (
    <button
      type="button"
      data-hotkey="go"
      className={view.mode === 'tv' ? 'q-btn-tv' : 'q-btn-gold'}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await ack(send('game:next'));
        setBusy(false);
      }}
    >
      {last ? 'النتيجة النهائية 🏆' : 'السؤال التالي ←'}
      <Kbd k="Enter" />
    </button>
  );
}

function SoloQuestion({ view, deadline }: { view: SoloView; deadline: number | null }) {
  const q = view.question!;
  const cat = view.categories.find((c) => c.id === q.categoryId);
  const isTv = view.you === 'tv';
  const lbl = actionLabel(view.variant);
  // The action waiting for its player: picked from the list that opens under the buttons.
  const [choosing, setChoosing] = useState<Action | null>(null);
  const [sent, setSent] = useState(false);
  useEffect(() => {
    setSent(false);
    setChoosing(null);
  }, [view.phase, view.myAction, view.myAnswer]);
  const others = view.players.filter((p) => p.id !== view.you);

  async function act(action: Action, target?: string) {
    setSent(true);
    if (!(await ack(send('game:action', { action, target })))) setSent(false);
  }
  async function answer(index: number) {
    setSent(true);
    if (!(await ack(send('game:answer', { index })))) setSent(false);
  }

  const mine = view.myAction ? actionInfo(view.variant, view.myAction) : null;
  const special = view.myAction !== null && view.myAction !== 'answer';
  const canAnswer = !isTv && view.phase === 'answer' && view.myAction === 'answer' && view.myAnswer === null && !sent;
  const r = view.result;
  const picks = r ? Object.values(r.rows).map((x) => x.pick) : [];
  const tone = (i: number) => {
    if (r) {
      if (i === r.correctIndex) return 'border-q-green bg-q-green/12 text-[#2ecc71]';
      if (picks.includes(i)) return 'border-q-red bg-q-red/12 text-q-red';
      return 'border-q-line opacity-60';
    }
    return i === view.myAnswer ? 'border-q-blue bg-q-blue/10' : 'border-q-line';
  };
  const choiceBtn = (action: Action, cls: string, icon: string, title: string, desc: string, k: string) => (
    <button
      type="button"
      data-hotkey={action === 'answer' ? 'answer' : action === 'reverse' ? 'reverse' : 'swap'}
      aria-pressed={choosing === action}
      onClick={() => (action === 'answer' ? void act('answer') : setChoosing(choosing === action ? null : action))}
      className={cn('rounded-xl bg-linear-to-br px-3 py-4 text-sm leading-normal font-black transition-transform hover:-translate-y-0.5', cls, choosing === action && 'ring-2 ring-white')}
    >
      {icon} {title}
      <Kbd k={k} />
      <small className="block text-[10px] opacity-80">{desc}</small>
    </button>
  );

  return (
    <div className="motion-safe:animate-fx-zoom">
      <Scores view={view} marks={view.phase === 'action' || view.phase === 'answer'} />
      {view.phase !== 'result' && <Countdown deadline={deadline} total={view.phase === 'answer' ? view.answerSeconds : view.actionSeconds} />}
      <div className={cn('mb-2.5 rounded-2xl border border-q-line bg-q-panel p-4', isTv && 'q-glass p-6 text-center sm:p-10')}>
        <div className="mb-1.5 text-[11px] font-bold tracking-widest text-q-gold">
          {cat?.icon} {cat?.name}
        </div>
        <div className="mb-2 inline-block rounded-lg border border-q-cyan/30 bg-q-cyan/15 px-2.5 py-0.5 text-xs font-bold text-q-cyan">{q.points} نقطة</div>
        <div className={cn('leading-relaxed font-bold', isTv ? 'text-2xl sm:text-4xl' : 'text-[17px]')}>{q.text}</div>
        <QuestionImage url={q.imageUrl} type={q.type} revealed={view.phase === 'result'} large={isTv} />
      </div>

      {view.phase === 'action' &&
        (isTv ? (
          <div className="p-3 text-center text-sm text-white/60">
            <WaitDots /> كل لاعب يختار قراره سرًا على جواله — قرّر {view.done.length} من {view.players.length}
          </div>
        ) : view.myAction === null && !sent ? (
          <>
            <div className="mb-2 text-center text-[13px] text-white/50">
              اختار قرارك <b className="text-white">سرًا</b> — {view.variant === 'triple' ? 'وإذا اخترت بادل أو اعكس' : `وإذا اخترت ${lbl.short}`} اختر اللاعب من القائمة تحت
            </div>
            <div className={cn('mb-2.5 grid gap-2.5', view.variant === 'triple' ? 'grid-cols-3' : 'grid-cols-2')}>
              {choiceBtn('steal', 'from-q-red to-[#c0392b]', lbl.icon, lbl.short, view.variant === 'flip' ? 'اقلب جواب لاعب' : 'خذ جواب لاعب', 'S')}
              {choiceBtn('answer', 'from-q-green to-[#1e8449]', '✅', 'جاوب', 'أجاوب بنفسي', 'A')}
              {view.variant === 'triple' && choiceBtn('reverse', 'from-q-purple to-[#6c3483]', '↩️', 'اعكس', 'صح = ينقص منك، غلط = يزيد لك', 'D')}
            </div>
            {choosing && (
              <div className="q-card mb-2.5 motion-safe:animate-fade-up">
                <div className="mb-2 text-center text-xs font-black text-white/70">
                  {actionInfo(view.variant, choosing).icon} {choosing === 'reverse' ? 'تعكس مين؟' : view.variant === 'flip' ? 'تقلب مين؟' : 'تبادل مع مين؟'}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {others.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => void act(choosing, p.id)}
                      className="rounded-xl border-2 border-q-line bg-q-bg px-2 py-3 text-sm font-black transition-all hover:border-q-gold active:scale-95"
                    >
                      🙋 {p.name}
                      <span className="block text-[10px] font-bold text-white/50">نقاطه: <span dir="ltr">{p.score}</span></span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-xl border border-q-gold/25 bg-q-gold/8 p-3.5 text-center">
            <div className="mb-1 text-3xl">{mine ? mine.icon : '🔒'}</div>
            <div className="text-sm font-bold text-q-gold">
              {view.myAction === 'answer' ? 'اخترت تجاوب بنفسك!' : mine ? `اخترت ال${mine.full} مع ${nameOf(view, view.myTarget)}!` : 'قرارك محفوظ!'}
            </div>
            <div className="mt-1 text-[11px] text-white/50">
              <WaitDots /> في انتظار باقي اللاعبين ({view.done.length} من {view.players.length})
            </div>
          </div>
        ))}

      {view.phase !== 'action' && (
        <>
          {!isTv && view.phase === 'answer' && (
            <div className="mb-2 text-center text-[13px] text-white/50">
              {special ? (
                <>
                  {mine?.icon} <b className="text-white">اخترت ال{mine?.full} مع {nameOf(view, view.myTarget)}</b> — في انتظار جوابه...
                </>
              ) : canAnswer ? (
                <b className="text-white">اختار إجابتك</b>
              ) : (
                <b className="text-white">في انتظار باقي اللاعبين...</b>
              )}
            </div>
          )}
          <div className="mb-2.5 grid grid-cols-2 gap-2">
            {q.options.map((opt, i) => (
              <button
                key={i}
                type="button"
                disabled={!canAnswer}
                data-hotkey={canAnswer ? String(i + 1) : undefined}
                onClick={() => answer(i)}
                className={cn('rounded-xl border-[1.5px] bg-q-bg px-3 py-3.5 text-sm font-bold transition-colors', tone(i), canAnswer ? 'hover:border-q-gold hover:bg-q-gold/6' : 'cursor-default', isTv && 'text-lg sm:text-2xl')}
              >
                {opt}
                {canAnswer && <Kbd k={String(i + 1)} />}
              </button>
            ))}
          </div>
          {view.phase === 'result' && r && (
            <>
              <ResultList view={view} />
              <NextButton view={view} last={view.used.length >= view.categories.length * POINTS.length} />
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── عدّها ────────────────────────────────────────────────────────────────

function SoloList({ view, deadline }: { view: SoloView; deadline: number | null }) {
  const list = view.list!;
  const isTv = view.you === 'tv';
  const [text, setText] = useState('');
  const [flash, setFlash] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const turnAway = !view.players.find((p) => p.id === view.turn)?.connected;
  const mayPick = view.turn === view.you || isTv || (view.host && turnAway);
  const header = (
    <div className="mb-3 flex items-center justify-center gap-2 text-xs font-bold text-white/60">
      <span className="rounded-full bg-q-pink/15 px-3 py-1 font-black text-q-pink">⏱️ عدّها</span>
      السؤال {list.round} من {list.totalRounds}
    </div>
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText('');
    input.current?.focus();
    const res = await send('game:listAnswer', { text: t });
    if (!res.ok) return toast.error(res.error);
    if (res.data.added.length) {
      play('pop');
      setFlash(res.data.added);
      setTimeout(() => setFlash([]), 1400);
    } else toast.info('ما لقيناه في القائمة — أو كتبته قبل', { duration: 1500 });
  }

  if (view.phase === 'board') {
    return (
      <div>
        <Scores view={view} />
        {header}
        {mayPick ? (
          <div className="q-card text-center">
            <div className="q-display mb-1 text-2xl">{view.turn === view.you ? 'دورك تختار الفئة' : `اختر الفئة عن ${nameOf(view, view.turn)}`}</div>
            <p className="mb-4 text-xs text-white/60">يطلع سؤال واحد للكل، وكل لاعب يكتب أكثر عدد أجوبة قبل ما يخلص الوقت</p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {list.categories.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={busy}
                  data-hotkey={String(i + 1)}
                  onClick={async () => {
                    setBusy(true);
                    await ack(send('game:listPick', { category: c.id }));
                    setBusy(false);
                  }}
                  className="q-spot rounded-2xl border-2 border-q-line bg-q-panel px-2 py-4 text-center transition-all hover:-translate-y-0.5 hover:border-q-gold disabled:opacity-50"
                >
                  <div className="mb-1 text-3xl">{c.icon}</div>
                  <div className="text-sm font-black">
                    {c.name}
                    <Kbd k={String(i + 1)} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="q-card p-8 text-center text-sm text-white/70">
            <WaitDots /> {nameOf(view, view.turn)} يختار الفئة…
          </div>
        )}
      </div>
    );
  }

  const q = list.question;
  if (view.phase === 'list' && q) {
    return (
      <div>
        <Countdown deadline={deadline} total={view.actionSeconds} />
        <div className="q-glass mb-3 p-5 text-center sm:p-7">
          <div className="mb-2 inline-block rounded-full bg-q-gold/15 px-3 py-1 text-xs font-black text-q-gold">{q.category}</div>
          {q.letter && (
            <div className="mb-3">
              <LetterGrid active={q.letter} small />
            </div>
          )}
          <div className={cn('font-black leading-snug', isTv ? 'text-3xl sm:text-5xl' : 'text-2xl')}>{q.text}</div>
        </div>
        <div className="mb-3 flex flex-wrap justify-center gap-2">
          {view.players.map((p) => (
            <div key={p.id} className={cn('rounded-xl border px-3 py-1.5 text-center', p.id === view.you ? 'border-q-gold/60 bg-q-gold/10' : 'border-q-line bg-q-panel')}>
              <div className="max-w-24 truncate text-[11px] font-bold text-white/70">{p.name}</div>
              <div key={list.found[p.id] ?? 0} className="q-display text-2xl tabular-nums motion-safe:animate-fx-bump">
                {list.found[p.id] ?? 0}
              </div>
            </div>
          ))}
        </div>
        {!isTv && (
          <>
            <form onSubmit={submit} className="mb-3 flex gap-2">
              <input
                ref={input}
                className="q-input flex-1 text-lg"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="اكتب جواب (أو أكثر بينها فاصلة) واضغط إرسال"
                maxLength={LIST_MAX_TEXT}
                autoComplete="off"
                autoFocus
                enterKeyHint="send"
                aria-label="جوابك"
              />
              <button type="submit" className="rounded-xl bg-linear-to-l from-q-orange to-q-gold px-5 font-black text-black active:scale-95">
                إرسال
              </button>
            </form>
            {flash.length > 0 && <div className="mb-2 text-center text-sm font-black text-q-green motion-safe:animate-pop-in">✅ {flash.join('، ')}</div>}
            <div className="q-card">
              <div className="mb-2 text-xs font-black text-white/70">✍️ أجوبتك ({list.mine.length})</div>
              {list.mine.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {list.mine.map((a) => (
                    <span key={a} className="rounded-lg border border-q-green/40 bg-q-green/10 px-2 py-1 text-xs font-black motion-safe:animate-pop-in">
                      {a}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-white/50">اكتب بسرعة! أجوبة باقي اللاعبين ما تبان لك إلا في النتيجة.</p>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  const res = list.result;
  if (view.phase === 'result' && res && q) {
    const mineFound = new Set(view.you === 'tv' ? [] : (res.found[view.you] ?? []));
    const anyone = new Set(Object.values(res.found).flat());
    return (
      <div>
        <Scores view={view} />
        {header}
        <div className="q-glass mb-3 p-4 text-center">
          <div className="mb-1 text-xs text-white/60">{q.category}</div>
          <div className="text-lg font-black">{q.text}</div>
          <div className="mt-1 text-[11px] text-white/50">نقطة لكل جواب صح، وأكثر ثلاثة ياخذون +{LIST_BONUS.join(' / +')}</div>
        </div>
        <ResultList view={view} />
        <div className="q-card mb-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-white/60">
            <span className="font-black text-white/80">كل الأجوبة ({res.answers.length})</span>
            {!isTv && <span className="rounded border border-q-gold/50 bg-q-gold/15 px-1.5">أجوبتك</span>}
            <span className="rounded border border-q-cyan/50 bg-q-cyan/15 px-1.5">لقاها لاعب ثاني</span>
          </div>
          <div className="flex max-h-72 flex-wrap gap-1.5 overflow-auto">
            {res.answers.map((a, i) => (
              <span
                key={i}
                className={cn(
                  'rounded-lg border px-2 py-0.5 text-xs font-bold',
                  mineFound.has(i) ? 'border-q-gold/50 bg-q-gold/15' : anyone.has(i) ? 'border-q-cyan/50 bg-q-cyan/15' : 'border-white/10 text-white/45',
                )}
              >
                {a}
              </span>
            ))}
          </div>
        </div>
        <NextButton view={view} last={list.round >= list.totalRounds} />
      </div>
    );
  }
  return null;
}

// ── Final ────────────────────────────────────────────────────────────────

function SoloFinal({ view, onPlayAgain }: { view: SoloView; onPlayAgain: () => void }) {
  const rows = [...view.players].sort((a, b) => b.score - a.score);
  const top = rows[0];
  const tie = rows.length > 1 && rows[1]!.score === top?.score;
  const medal = ['🥇', '🥈', '🥉'];
  return (
    <div className="animate-fade-up px-4 py-9 text-center">
      {!tie && <Confetti big />}
      <div className="mb-3 animate-trophy text-7xl">{tie ? '🤝' : '🏆'}</div>
      <div className="mb-6 text-[26px] font-black text-q-gold">{tie ? 'تعادل على المركز الأول!' : `${top?.name} الفائز!`}</div>
      <div className="mx-auto mb-6 grid max-w-md gap-2">
        {rows.map((p, i) => (
          <div key={p.id} className={cn('flex items-center gap-3 rounded-2xl bg-q-panel px-4 py-3', i === 0 && 'ring-2 ring-q-gold', p.id === view.you && 'border border-q-gold/40')}>
            <span className="w-8 text-2xl">{medal[i] ?? `${i + 1}`}</span>
            <span className="flex-1 truncate text-start font-black">{p.name}</span>
            <span dir="ltr" className="q-display text-2xl tabular-nums text-q-gold">{p.score}</span>
          </div>
        ))}
      </div>
      <button type="button" data-hotkey="go" className="q-btn-gold" onClick={onPlayAgain}>
        🔄 العب مرة ثانية
        <Kbd k="Enter" />
      </button>
    </div>
  );
}

export function SoloGame({ view, deadline, onPlayAgain }: { view: SoloView; deadline: number | null; onPlayAgain: () => void }) {
  if (view.status === 'lobby') return <SoloLobby view={view} />;
  if (view.status === 'done') return <SoloFinal view={view} onPlayAgain={onPlayAgain} />;
  if (view.variant === 'list') return <SoloList view={view} deadline={deadline} />;
  if (view.phase === 'board') return <SoloBoard view={view} />;
  return <SoloQuestion view={view} deadline={deadline} />;
}
