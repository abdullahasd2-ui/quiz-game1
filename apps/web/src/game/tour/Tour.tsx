// «اكتشف طريقة اللعب»: an interactive tour of one round of «جاوب أو بادل», played for real on the app's own data:
// the real categories, a real question drawn from the bank for the cell you pick, and the real scoring rules of the
// mode. The opponent is a practice team (labelled so on screen): nothing here pretends to be a live match.
// Seven stages: intro → how a game starts → categories → the board → your secret choice → the answer → points →
// the round's result and «ابدأ اللعب الآن».
// `auto` plays the tour by itself with the same handlers a finger would use (each press is shown first): for the
// App Store preview recording (?tour=auto). Everything is sized for phone, tablet and desktop.
import { POINTS, type PublicCategory, type TourQuestion } from '@quiz/shared';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/lib/api';
import { SaveVideoButton, TOUR_VIDEO } from '@/kick/VideoGuide';
import { cn } from '@/lib/utils';
import { Background3D } from '../fx/Background3D';
import { Confetti, prefersReducedMotion } from '../fx/Confetti';
import { CountUp } from '../fx/CountUp';
import { play, unlockAudio } from '../fx/sound';
import './tour.css';

type Stage = 'intro' | 'start' | 'cats' | 'board' | 'decide' | 'answer' | 'points' | 'final';
const ORDER: Stage[] = ['intro', 'start', 'cats', 'board', 'decide', 'answer', 'points', 'final'];
const LABELS = ['البداية', 'الفئات', 'السؤال', 'قرارك', 'الجواب', 'النقاط', 'النتيجة'];
type Choice = 'answer' | 'swap';
const US = { name: 'الصقور', icon: '🦁' };
const THEM = { name: 'النمور', icon: '🐯' };
const ANSWER_SECONDS = 30;

export function Tour({ open, auto = false, onClose, onPlay }: { open: boolean; auto?: boolean; onClose: () => void; onPlay: () => void }) {
  if (!open) return null;
  return createPortal(<TourBody auto={auto} onClose={onClose} onPlay={onPlay} />, document.body);
}

function TourBody({ auto, onClose, onPlay }: { auto: boolean; onClose: () => void; onPlay: () => void }) {
  const [stage, setStage] = useState<Stage>('intro');
  const [picked, setPicked] = useState<PublicCategory[]>([]);
  const [cell, setCell] = useState<{ cat: PublicCategory; points: number } | null>(null);
  const [q, setQ] = useState<TourQuestion | null>(null);
  const [loadingQ, setLoadingQ] = useState(false);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [mine, setMine] = useState<number | null>(null);
  // The practice team: it answers when you swap; right about two times in three, like a decent team.
  const [theirs, setTheirs] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [pressing, setPressing] = useState<string | null>(null);
  const [runId, setRunId] = useState(0);
  const cats = useQuery({ queryKey: ['public-categories'], queryFn: api.publicCategories, staleTime: 60_000 });
  const playable = useMemo(() => (cats.data ?? []).filter((c) => c.playable).slice(0, 9), [cats.data]);

  useEffect(() => {
    void api.tourEvent('open');
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', esc);
    };
  }, [onClose]);

  const go = useCallback((s: Stage) => {
    play('whoosh');
    setStage(s);
  }, []);

  // ── Actions (a finger and the auto-player use the same ones) ──
  const toggleCat = (c: PublicCategory) => {
    play('pop');
    setPicked((p) => (p.some((x) => x.id === c.id) ? p.filter((x) => x.id !== c.id) : p.length >= 3 ? p : [...p, c]));
  };
  const pickCell = async (cat: PublicCategory, points: number) => {
    if (loadingQ) return;
    play('tap');
    setCell({ cat, points });
    setLoadingQ(true);
    try {
      const got = await api.tourQuestion(cat.id, points);
      setQ(got);
      setChoice(null);
      setMine(null);
      setTheirs(null);
      setRevealed(false);
      go('decide');
    } catch {
      setCell(null);
    } finally {
      setLoadingQ(false);
    }
  };
  const decide = (c: Choice) => {
    if (!q) return;
    play('lock');
    setChoice(c);
    // When you swap, the practice team answers for real (and you take its answer).
    if (c === 'swap') {
      const right = Math.random() < 0.67 || auto;
      setTheirs(right ? q.correctIndex : (q.correctIndex + 1 + Math.floor(Math.random() * 3)) % q.options.length);
    }
    window.setTimeout(() => go('answer'), 650);
  };
  const answer = (i: number) => {
    if (mine !== null || revealed) return;
    play('tap');
    setMine(i);
  };
  // Reveal: after your pick (or the practice team's, when you swapped).
  useEffect(() => {
    if (stage !== 'answer' || !q) return;
    const ready = choice === 'answer' ? mine !== null : theirs !== null;
    if (!ready) return;
    const t = window.setTimeout(
      () => {
        setRevealed(true);
        const ok = (choice === 'answer' ? mine : theirs) === q.correctIndex;
        play(ok ? 'win' : 'wrong');
      },
      choice === 'answer' ? 700 : 1900,
    );
    return () => window.clearTimeout(t);
  }, [stage, q, choice, mine, theirs]);

  // The round's points, by the mode's real rules (see «طريقة اللعب» → «جاوب أو بادل»).
  const outcome = useMemo(() => {
    if (!q || !choice) return null;
    const p = q.points;
    if (choice === 'answer') {
      const ok = mine === q.correctIndex;
      return { us: ok ? p : 0, them: 0, row: ok ? 0 : 1, line: ok ? `جاوبتوا صح: +${p} لفريقكم` : mine === -1 ? 'خلص الوقت بدون جواب: ما تاخذون شي' : 'جوابكم غلط: ما تاخذون شي، وما ينقص منكم' };
    }
    const ok = theirs === q.correctIndex;
    return ok
      ? { us: p * 2, them: 0, row: 2, line: `بادلتوا وجواب ${THEM.name} صح: لكم دبل +${p * 2}، و${THEM.name} صفر لأن جوابهم انزرف` }
      : { us: -p, them: 0, row: 3, line: `بادلتوا وجواب ${THEM.name} غلط: ينقص منكم ${p}` };
  }, [q, choice, mine, theirs]);

  const finish = () => {
    void api.tourEvent('finish');
    go('final');
    play('fanfare', 0.4);
  };
  const restart = () => {
    setPicked([]);
    setCell(null);
    setQ(null);
    setChoice(null);
    setMine(null);
    setTheirs(null);
    setRevealed(false);
    setRunId((n) => n + 1);
    go('intro');
  };

  // ── Intro: the logo lands, then the tour moves on by itself ──
  useEffect(() => {
    if (stage !== 'intro') return;
    play('boom', 0.25);
    const t = window.setTimeout(() => go('start'), prefersReducedMotion() ? 600 : 2900);
    return () => window.clearTimeout(t);
  }, [stage, go, runId]);

  // ── Auto-play for the recording: each step is shown being pressed, then pressed. Each stage is scheduled once
  // (picking a category re-renders, and must not restart the script).
  const timers = useRef<number[]>([]);
  const scheduled = useRef('');
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const press = useCallback((key: string, fn: () => void, at: number) => {
    timers.current.push(window.setTimeout(() => setPressing(key), Math.max(0, at - 420)));
    timers.current.push(
      window.setTimeout(() => {
        setPressing(null);
        fn();
      }, at),
    );
  }, []);
  useEffect(() => {
    if (!auto) return;
    const key = `${runId}:${stage}:${stage === 'cats' ? playable.length >= 3 : ''}:${stage === 'answer' ? `${Boolean(q)}${revealed}` : ''}:${stage === 'board' ? picked.length : ''}`;
    if (scheduled.current === key) return;
    scheduled.current = key;
    if (stage === 'start') press('next-start', () => go('cats'), 3300);
    if (stage === 'cats' && playable.length >= 3) {
      const want = [playable[0]!, playable[2]!, playable[4] ?? playable[1]!];
      want.forEach((c, i) => press(`cat-${c.id}`, () => toggleCat(c), 900 + i * 520));
      press('next-cats', () => go('board'), 900 + 3 * 520 + 700);
    }
    if (stage === 'board' && picked[0]) press(`cell-${picked[0].id}-200`, () => void pickCell(picked[0]!, 200), 1500);
    if (stage === 'decide') press('choice-answer', () => decide('answer'), 2300);
    if (stage === 'answer' && q && !revealed) press(`opt-${q.correctIndex}`, () => answer(q.correctIndex), 1700);
    if (stage === 'answer' && revealed) press('next-answer', () => go('points'), 1500);
    if (stage === 'points') press('next-points', finish, 3200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, stage, playable.length, picked.length, q, revealed, runId]);

  const idx = Math.max(0, ORDER.indexOf(stage) - 1);
  const pr = (key: string) => (pressing === key ? 'tour-press' : '');

  return (
    <div className="tour-root fixed inset-0 z-[90] flex flex-col overflow-hidden bg-q-bg text-white isolate" dir="rtl" role="dialog" aria-modal="true" aria-label="اكتشف طريقة اللعب" onPointerDown={unlockAudio}>
      <Background3D />
      <div className="tour-vignette pointer-events-none absolute inset-0 -z-[1]" />
      {/* Top: practice label, progress through the seven stages, close. */}
      {stage !== 'intro' && (
        <div className="relative z-10 mx-auto flex w-full max-w-3xl items-center gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <span className="tour-badge shrink-0">🎓 تجربة تعليمية</span>
          <div className="flex flex-1 gap-1.5" aria-label={`المرحلة ${idx + 1} من ${LABELS.length}`}>
            {LABELS.map((l, i) => (
              <div key={l} className="flex-1">
                <div className={cn('tour-step', i < idx && 'done', i === idx && 'now')} />
                <div className={cn('mt-1 hidden text-center text-[10px] font-bold sm:block', i === idx ? 'text-q-gold' : 'text-white/40')}>{l}</div>
              </div>
            ))}
          </div>
          <button type="button" onClick={onClose} className="grid size-11 shrink-0 place-items-center rounded-full border border-white/15 bg-white/10 text-xl font-black" aria-label="إغلاق الشرح">
            ✕
          </button>
        </div>
      )}

      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {stage === 'intro' && <Intro key={runId} onSkip={() => go('start')} />}

        {stage === 'start' && (
          <Scene key="start" title="فريقين… وكل فريق من جواله" sub="واحد ينشئ الغرفة، والفريق الثاني ينضم بالكود. أول من يدخل الفريق هو الرئيس.">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
              <TeamCard t={US} tone="blue" delay={0.15} note="أنشأ الغرفة" />
              <div className="tour-code mx-auto" style={{ '--d': '0.5s' } as CSSProperties}>
                <div className="text-[11px] font-bold text-white/60">كود الغرفة</div>
                <div className="font-black tracking-[0.3em] text-q-gold">J A W 2 B 6</div>
              </div>
              <TeamCard t={THEM} tone="red" delay={0.85} note="انضم بالكود" />
            </div>
            <div className="mt-5 grid gap-2 text-[13px] sm:grid-cols-3">
              {[
                ['🎯', 'اختاروا الفئات'],
                ['🧩', 'كل فريق يختار سؤال بدوره'],
                ['🤫', 'وكل سؤال: جاوب أو بادل… سرًا'],
              ].map(([i, t], k) => (
                <div key={t} className="tour-rise flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-3" style={{ '--d': `${1.2 + k * 0.15}s` } as CSSProperties}>
                  <span className="text-xl">{i}</span>
                  <b>{t}</b>
                </div>
              ))}
            </div>
            <Next id="next-start" className={pr('next-start')} onClick={() => go('cats')}>
              يلا نختار الفئات
            </Next>
          </Scene>
        )}

        {stage === 'cats' && (
          <Scene key="cats" title="اختاروا 3 فئات" sub="هذي فئات اللعبة الحقيقية. في اللعبة تختارون 3 فئات أو أكثر، وكل فئة تصير عمود في اللوحة.">
            {cats.isPending ? (
              <div className="py-10 text-center text-white/60">جاري تحميل الفئات…</div>
            ) : (
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                {playable.map((c, i) => {
                  const on = picked.some((x) => x.id === c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCat(c)}
                      className={cn('tour-cat', on && 'on', pr(`cat-${c.id}`))}
                      style={{ '--i': i } as CSSProperties}
                      aria-pressed={on}
                    >
                      <span className="text-3xl sm:text-4xl">{c.icon}</span>
                      <span className="mt-1 text-[13px] font-black sm:text-sm">{c.name}</span>
                      {on && <span className="tour-tick">✓</span>}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="mt-3 text-center text-xs font-bold text-white/60">
              اخترت <b className="text-q-gold">{picked.length}</b> من 3
            </div>
            <Next id="next-cats" className={pr('next-cats')} disabled={picked.length < 3} onClick={() => go('board')}>
              ابدأ اللوحة
            </Next>
          </Scene>
        )}

        {stage === 'board' && (
          <Scene key="board" title="اختاروا سؤال من اللوحة" sub="كل ما زادت النقاط صعب السؤال. جرّب أي خانة، والسؤال اللي يطلع لك من بنك أسئلة اللعبة الحقيقي.">
            <div className="tour-board grid grid-cols-3 gap-2 sm:gap-2.5">
              {picked.map((c, ci) => (
                <div key={c.id} className="tour-colhead" style={{ '--i': ci } as CSSProperties}>
                  <span className="text-xl">{c.icon}</span>
                  <span className="truncate text-[12px] font-black sm:text-sm">{c.name}</span>
                </div>
              ))}
              {POINTS.flatMap((p, ri) =>
                picked.map((c, ci) => (
                  <button
                    key={`${c.id}-${p}`}
                    type="button"
                    disabled={loadingQ}
                    onClick={() => void pickCell(c, p)}
                    className={cn('tour-cell', cell?.cat.id === c.id && cell.points === p && 'busy', pr(`cell-${c.id}-${p}`))}
                    style={{ '--i': ri * 3 + ci } as CSSProperties}
                  >
                    {p}
                  </button>
                )),
              )}
            </div>
            <div className="mt-3 flex items-center justify-center gap-4 text-xs font-bold text-white/60">
              <span>🟢 100 سهل</span>
              <span>🟡 300 متوسط</span>
              <span>🔴 500 صعب</span>
            </div>
            {loadingQ && <div className="mt-3 text-center text-sm text-q-gold">يسحب سؤال من البنك…</div>}
          </Scene>
        )}

        {(stage === 'decide' || stage === 'answer') && q && cell && (
          <Scene key="q" title={stage === 'decide' ? 'قراركم السري' : choice === 'answer' ? 'جاوبوا!' : `${THEM.name} يجاوبون…`} sub={stage === 'decide' ? 'قبل ما تطلع الخيارات: تجاوبون بنفسكم، أو تبادلون وتاخذون جواب الخصم؟ الخصم يقرر سرًا مثلكم.' : undefined}>
            <div className="tour-q">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="tour-pill">
                  {cell.cat.icon} {cell.cat.name}
                </span>
                <span className="tour-pill gold">{q.points} نقطة</span>
              </div>
              {q.imageUrl && q.type !== 'text' && <img src={q.imageUrl} alt="" className="mx-auto mb-3 max-h-44 rounded-xl object-contain" />}
              <div className="tour-q-text">{q.text}</div>
            </div>

            {stage === 'decide' && (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => decide('answer')} disabled={!!choice} className={cn('tour-choice green', choice === 'answer' && 'chosen', pr('choice-answer'))}>
                    <span className="text-3xl">✅</span>
                    <b className="text-xl">جاوب</b>
                    <span className="text-[11px] font-bold text-white/80">جوابكم صح = +{q.points}</span>
                  </button>
                  <button type="button" onClick={() => decide('swap')} disabled={!!choice} className={cn('tour-choice red', choice === 'swap' && 'chosen', pr('choice-swap'))}>
                    <span className="text-3xl">🔄</span>
                    <b className="text-xl">بادل</b>
                    <span className="text-[11px] font-bold text-white/80">جواب الخصم صح = دبل +{q.points * 2}</span>
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-center gap-2 text-sm text-white/70">
                  <span className="text-lg">{THEM.icon}</span> {THEM.name} يختارون سرًا <span className="tour-dots" aria-hidden><i /><i /><i /></span>
                </div>
              </>
            )}

            {stage === 'answer' && (
              <>
                <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                  {q.options.map((o, i) => {
                    const who = choice === 'answer' ? mine : theirs;
                    const right = revealed && i === q.correctIndex;
                    const wrong = revealed && i === who && i !== q.correctIndex;
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={choice !== 'answer' || mine !== null}
                        onClick={() => answer(i)}
                        className={cn('tour-opt', who === i && 'picked', right && 'right', wrong && 'wrong', revealed && !right && !wrong && 'dim', pr(`opt-${i}`))}
                        style={{ '--i': i } as CSSProperties}
                      >
                        <span className="n">{i + 1}</span>
                        <span className="flex-1 text-start">{o}</span>
                        {who === i && !revealed && <span className="text-xs font-black text-q-gold">{choice === 'answer' ? 'جوابكم' : `جواب ${THEM.name}`}</span>}
                        {right && <span className="tour-stamp">✓</span>}
                        {wrong && <span className="tour-stamp bad">✕</span>}
                      </button>
                    );
                  })}
                </div>
                {!revealed && choice === 'answer' && mine === null && <AnswerTimer seconds={ANSWER_SECONDS} onEnd={() => setMine(-1)} />}
                {!revealed && choice === 'swap' && (
                  <div className="mt-3 text-center text-sm text-white/70">
                    🔄 بادلتوا: جواب {THEM.name} هو جوابكم <span className="tour-dots" aria-hidden><i /><i /><i /></span>
                  </div>
                )}
                {revealed && outcome && (
                  <div className={cn('tour-verdict', outcome.us > 0 ? 'good' : outcome.us < 0 ? 'bad' : 'flat')}>
                    {outcome.us > 0 && <Confetti count={70} />}
                    <div className="text-4xl font-black">{outcome.us > 0 ? (choice === 'swap' ? '🔥 دبل!' : '🎉 صح!') : outcome.us < 0 ? '💥 انقلبت عليكم' : '😅 ما ضبطت'}</div>
                    <div className="mt-1 text-sm font-bold text-white/85">{outcome.line}</div>
                  </div>
                )}
                {revealed && (
                  <Next id="next-answer" className={pr('next-answer')} onClick={() => go('points')}>
                    شوف النقاط
                  </Next>
                )}
              </>
            )}
          </Scene>
        )}

        {stage === 'points' && q && outcome && (
          <Scene key="points" title="كيف تنحسب النقاط" sub={`سؤال بـ ${q.points} نقطة، وهذي كل الحالات. الحالة اللي صارت لكم مضاءة.`}>
            <div className="grid grid-cols-2 gap-3">
              <Score t={US} tone="blue" to={outcome.us} />
              <Score t={THEM} tone="red" to={outcome.them} />
            </div>
            <div className="mt-4 grid gap-2">
              {[
                ['✅ جاوب', 'جوابكم صح', `+${q.points}`, 'good'],
                ['✅ جاوب', 'جوابكم غلط', '0', 'dim'],
                ['🔄 بادل', 'جواب الخصم صح', `+${q.points * 2} دبل`, 'gold'],
                ['🔄 بادل', 'جواب الخصم غلط', `−${q.points}`, 'bad'],
              ].map(([a, w, pts, tone], i) => (
                <div key={i} className={cn('tour-rule', tone, i === outcome.row && 'hit')} style={{ '--i': i } as CSSProperties}>
                  <b className="w-16 shrink-0">{a}</b>
                  <span className="flex-1 text-white/80">{w}</span>
                  <b className="tabular-nums" dir="ltr">
                    {pts}
                  </b>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-2xl border border-q-orange/30 bg-q-orange/10 p-3 text-center text-[13px] font-bold text-white/85">
              🔥 ثلاث أجوبة صح ورا بعض؟ الثالث يصير دبل. وإذا الفريقين بادلوا، ما أحد ياخذ نقاط.
            </div>
            <Next id="next-points" className={pr('next-points')} onClick={finish}>
              نتيجة الجولة
            </Next>
          </Scene>
        )}

        {stage === 'final' && outcome && (
          <Scene key="final">
            <div className="tour-final text-center">
              <div className="tour-rays" aria-hidden />
              <div className="tour-trophy">{outcome.us > 0 ? '🏆' : '💪'}</div>
              <div className="q-display mt-2 text-4xl sm:text-5xl">{outcome.us > 0 ? `${US.name} يتقدمون!` : 'الجولة الجاية لكم!'}</div>
              <div className="mt-2 flex items-center justify-center gap-3 text-2xl font-black">
                <span className="text-q-blue">
                  {US.icon} <bdi dir="ltr">{outcome.us}</bdi>
                </span>
                <span className="text-white/40">—</span>
                <span className="text-q-red">
                  <bdi dir="ltr">{outcome.them}</bdi> {THEM.icon}
                </span>
              </div>
              <p className="mx-auto mt-4 max-w-md text-[14px] leading-relaxed text-white/75">
                هذا سؤال واحد. اللعبة الكاملة لوحة كاملة من الأسئلة، والفريقين يتبادلون الدور، واللي يجمع نقاط أكثر يفوز.
              </p>
              <button
                type="button"
                className="q-btn-gold q-shine mx-auto mt-6 max-w-sm text-lg"
                onClick={() => {
                  void api.tourEvent('play');
                  onPlay();
                }}
              >
                🚀 ابدأ اللعب الآن
              </button>
              <div className="mt-4 flex justify-center">
                <SaveVideoButton src={TOUR_VIDEO} name="jawab-badel-discover.mp4" title="جاوب أو بادل: اكتشف طريقة اللعب" />
              </div>
              <div className="mt-1 text-[11px] text-white/45">فيديو هذي التجربة في 30 ثانية، تحفظه وتنشره</div>
              <button type="button" className="mt-3 text-sm font-bold text-white/60 underline-offset-4 hover:underline" onClick={restart}>
                ↺ عيد التجربة
              </button>
            </div>
          </Scene>
        )}
      </div>
    </div>
  );
}

/** The opening: the logo assembles from light, letter by letter, under a sweeping glint; tap skips it. */
function Intro({ onSkip }: { onSkip: () => void }) {
  // Arabic letters must stay joined, so whole words move: each one drops in and is wiped on from the right.
  const word = (w: string, d: number, cls: string) => (
    <span className={cn('tour-word', cls)} style={{ '--d': `${d}s` } as CSSProperties}>
      {w}
    </span>
  );
  return (
    <button type="button" className="tour-intro m-auto flex flex-col items-center" onClick={onSkip} aria-label="تخطي المقدمة">
      <div className="tour-burst" aria-hidden />
      <div className="tour-ring" aria-hidden />
      <h1 className="q-display relative text-7xl leading-[1.15] sm:text-8xl">
        {word('جاوب', 0.35, 'bg-linear-to-l from-q-purple to-q-pink bg-clip-text text-transparent')}
        {word('أو', 0.75, 'mx-3 text-4xl text-white/70 sm:text-5xl')}
        {word('بادل', 0.95, 'bg-linear-to-l from-q-cyan to-[#7dd3fc] bg-clip-text text-transparent')}
        <span className="tour-glint" aria-hidden />
      </h1>
      <div className="tour-tag mt-4 text-base font-bold text-white/75">اكتشف اللعبة في دقيقة</div>
    </button>
  );
}

function Scene({ title, sub, children }: { title?: string; sub?: string; children: ReactNode }) {
  return (
    <section className="tour-scene my-auto py-5">
      {title && <h2 className="q-display text-center text-3xl leading-tight sm:text-4xl">{title}</h2>}
      {sub && <p className="mx-auto mt-2 max-w-xl text-center text-[14px] leading-relaxed text-white/70 sm:text-[15px]">{sub}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Next({ id, onClick, disabled, className, children }: { id: string; onClick: () => void; disabled?: boolean; className?: string; children: ReactNode }) {
  return (
    <button type="button" data-tour={id} onClick={onClick} disabled={disabled} className={cn('q-btn-gold tour-next mx-auto mt-6 block max-w-sm text-base disabled:opacity-40', className)}>
      {children} ←
    </button>
  );
}

function TeamCard({ t, tone, delay, note }: { t: { name: string; icon: string }; tone: 'blue' | 'red'; delay: number; note: string }) {
  return (
    <div className={cn('tour-team', tone)} style={{ '--d': `${delay}s` } as CSSProperties}>
      <div className="text-4xl">{t.icon}</div>
      <div className="mt-1 text-lg font-black">{t.name}</div>
      <div className="text-[11px] font-bold text-white/60">{note}</div>
    </div>
  );
}

function Score({ t, tone, to }: { t: { name: string; icon: string }; tone: 'blue' | 'red'; to: number }) {
  return (
    <div className={cn('tour-score', tone)}>
      <div className="text-sm font-black">
        {t.icon} {t.name}
      </div>
      <div className="mt-1 text-4xl font-black tabular-nums" dir="ltr">
        <CountUp to={to} ms={900} delay={350} signed={false} />
      </div>
      {to !== 0 && (
        <div className={cn('tour-delta', to > 0 ? 'text-q-green' : 'text-q-red')} dir="ltr">
          {to > 0 ? `+${to}` : to}
        </div>
      )}
    </div>
  );
}

function AnswerTimer({ seconds, onEnd }: { seconds: number; onEnd: () => void }) {
  const [left, setLeft] = useState(seconds);
  const end = useRef(onEnd);
  end.current = onEnd;
  useEffect(() => {
    const t0 = Date.now();
    const id = window.setInterval(() => {
      const l = Math.max(0, seconds - Math.floor((Date.now() - t0) / 1000));
      setLeft(l);
      if (l <= 0) {
        window.clearInterval(id);
        end.current();
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [seconds]);
  return (
    <div className="mt-4">
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className={cn('h-full rounded-full transition-[width] duration-300', left <= 5 ? 'bg-q-red' : 'bg-linear-to-l from-q-gold to-q-orange')} style={{ width: `${(left / seconds) * 100}%` }} />
      </div>
      <div className="mt-1 text-center text-xs font-bold text-white/60">باقي {left} ثانية</div>
    </div>
  );
}
