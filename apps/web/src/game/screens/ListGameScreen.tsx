// «عدّها» in the main game: the team in turn picks a category, then both teams type as many answers as they can.
// Captains and members alike type (each device sends its own answers); the server counts each answer once per team.
import { canAdvance, canPick, LIST_MAX_TEXT, LIST_TEAM_BONUS, type RoomView, type TeamIndex } from '@quiz/shared';
import { useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Kbd } from '@/lib/hotkeys';
import { cn } from '@/lib/utils';
import { LetterGrid } from '@/kick/ListParts';
import { send } from '../connection';
import { play } from '../fx/sound';
import { Countdown, Scorebar, teamName, WaitDots } from '../ui';

const TEAM_CHIP = ['border-q-blue/50 bg-q-blue/15 text-[#7cc4f5]', 'border-q-red/50 bg-q-red/15 text-[#f5928a]'] as const;

export function ListGameScreen({ view, deadline }: { view: RoomView; deadline: number | null }) {
  const list = view.list!;
  const me = view.you === 'tv' ? null : (view.you as TeamIndex);
  const [text, setText] = useState('');
  const [flash, setFlash] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  // The captain (or the TV) picks the category; members wait for it like in the other modes.
  const mayPick = canPick(view.mode, view.you, view.turn) && view.role !== 'member';
  const mayAdvance = canAdvance(view.mode, view.you) && view.role !== 'member';

  async function pick(category: string) {
    setBusy(true);
    const res = await send('game:listPick', { category });
    setBusy(false);
    if (!res.ok) toast.error(res.error);
  }

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
    } else toast.info('ما لقيناه في القائمة — أو قلتوه قبل', { duration: 1500 });
  }

  async function next() {
    setBusy(true);
    const res = await send('game:next');
    setBusy(false);
    if (!res.ok) toast.error(res.error);
  }

  const header = (
    <div className="mb-3 flex items-center justify-center gap-2 text-xs font-bold text-white/60">
      <span className="rounded-full bg-q-pink/15 px-3 py-1 font-black text-q-pink">⏱️ عدّها</span>
      الجولة {list.round} من {list.totalRounds}
    </div>
  );

  // ── The team in turn picks the category ──
  if (view.phase === 'board') {
    return (
      <div>
        <Scorebar view={view} highlightTurn />
        {header}
        {mayPick ? (
          <div className="q-card text-center">
            <div className="q-display mb-1 text-2xl">دوركم تختارون الفئة</div>
            <p className="mb-4 text-xs text-white/60">يطلع سؤال واحد للفريقين، والكل يكتب أكثر عدد أجوبة قبل ما يخلص الوقت</p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {list.categories.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={busy}
                  data-hotkey={String(i + 1)}
                  onClick={() => void pick(c.id)}
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
            <WaitDots /> {view.role === 'member' && view.you === view.turn ? 'رئيس فريقك يختار الفئة…' : `${teamName(view, view.turn)} يختار الفئة…`}
          </div>
        )}
      </div>
    );
  }

  const q = list.question;
  // ── Typing ──
  if (view.phase === 'list' && q) {
    return (
      <div>
        <Scorebar view={view} />
        <Countdown deadline={deadline} total={list.seconds} />
        <div className="q-glass mb-3 p-5 text-center sm:p-7">
          <div className="mb-2 inline-block rounded-full bg-q-gold/15 px-3 py-1 text-xs font-black text-q-gold">{q.category}</div>
          {q.letter && (
            <div className="mb-3">
              <LetterGrid active={q.letter} small />
            </div>
          )}
          <div className={cn('font-black leading-snug', view.you === 'tv' ? 'text-3xl sm:text-5xl' : 'text-2xl')}>{q.text}</div>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-2.5">
          {([0, 1] as const).map((t) => (
            <div key={t} className={cn('rounded-2xl border p-3 text-center', TEAM_CHIP[t], me === t && 'ring-2 ring-white/30')}>
              <div className="truncate text-xs font-bold text-white/70">{teamName(view, t)}</div>
              <div key={list.found[t]} className="q-display text-4xl tabular-nums motion-safe:animate-fx-bump">{list.found[t]}</div>
              <div className="text-[11px] text-white/60">جواب صح</div>
            </div>
          ))}
        </div>
        {me !== null && (
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
              <div className="mb-2 text-xs font-black text-white/70">✍️ أجوبة فريقك ({list.mine.length})</div>
              {list.mine.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {list.mine.map((a) => (
                    <span key={a} className="rounded-lg border border-q-green/40 bg-q-green/10 px-2 py-1 text-xs font-black motion-safe:animate-pop-in">
                      {a}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-white/50">اكتبوا بسرعة! كل لاعب في الفريق يقدر يكتب، وأجوبة الفريق الثاني ما تبان لكم إلا في النتيجة.</p>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Result ──
  const res = list.result;
  if (view.phase === 'result' && res && q) {
    const by = (i: number) => [res.found[0].includes(i), res.found[1].includes(i)] as const;
    const winner = res.deltas[0] > res.deltas[1] ? 0 : res.deltas[1] > res.deltas[0] ? 1 : null;
    return (
      <div>
        <Scorebar view={view} />
        {header}
        <div className="q-glass mb-3 p-5 text-center">
          <div className="mb-1 text-xs text-white/60">{q.category}</div>
          <div className="mb-3 text-lg font-black">{q.text}</div>
          <div className="grid grid-cols-2 gap-2.5">
            {([0, 1] as const).map((t) => (
              <div key={t} className={cn('rounded-2xl border p-3', TEAM_CHIP[t], winner === t && 'ring-2 ring-q-gold')}>
                <div className="truncate text-xs font-bold text-white/70">{teamName(view, t)}</div>
                <div className="q-display text-3xl text-white">+{res.deltas[t]}</div>
                <div className="text-[11px] text-white/60">
                  {res.found[t].length} جواب{winner === t ? ` + بونص ${LIST_TEAM_BONUS}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="q-card mb-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-white/60">
            <span className="font-black text-white/80">كل الأجوبة ({res.answers.length})</span>
            <span className="rounded border border-q-blue/50 bg-q-blue/15 px-1.5">{teamName(view, 0)}</span>
            <span className="rounded border border-q-red/50 bg-q-red/15 px-1.5">{teamName(view, 1)}</span>
            <span className="rounded border border-q-purple/50 bg-q-purple/20 px-1.5">الاثنين</span>
          </div>
          <div className="flex max-h-72 flex-wrap gap-1.5 overflow-auto">
            {res.answers.map((a, i) => {
              const [x, y] = by(i);
              return (
                <span
                  key={i}
                  className={cn(
                    'rounded-lg border px-2 py-0.5 text-xs font-bold',
                    x && y ? 'border-q-purple/50 bg-q-purple/20' : x ? TEAM_CHIP[0] : y ? TEAM_CHIP[1] : 'border-white/10 text-white/45',
                  )}
                >
                  {a}
                </span>
              );
            })}
          </div>
        </div>
        {mayAdvance ? (
          <button type="button" data-hotkey="go" className="q-btn-gold" onClick={next} disabled={busy}>
            {list.round >= list.totalRounds ? 'النتيجة النهائية 🏆' : 'الجولة التالية ←'}
            <Kbd k="Enter" />
          </button>
        ) : (
          <div className="p-3 text-center text-xs text-white/50">
            <WaitDots /> في انتظار الجولة التالية…
          </div>
        )}
      </div>
    );
  }

  return null;
}
