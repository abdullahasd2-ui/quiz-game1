import { displayName, POINTS, standings, type PublicCategory, type StreamState } from '@quiz/shared';
import { QuestionImage } from '@/game/ui';
import { cn } from '@/lib/utils';
import { OUTCOME } from './outcome';

export type BroadcastProps = {
  /** Already scrubbed with `publicView`: this is what the viewers see. */
  state: StreamState;
  /** Seconds-resolution clock, already corrected to the game's clock. */
  now: number;
  cats: PublicCategory[];
  chosen: number[];
  busy?: boolean;
  /** Host buttons (board pick, skip the countdown, next, end); the control page leaves them out. */
  onPick?: (category: number, points: number) => void;
  onShow?: () => void;
  onFinish?: () => void;
  onBoard?: () => void;
  onEnd?: () => void;
};

const names = (s: StreamState, keys: string[]) => {
  const list = keys.map((k) => displayName(s, k));
  return list.length > 3 ? `${list.slice(0, 3).join('، ')} +${list.length - 3}` : list.join('، ');
};

/** The page that goes on the stream: board, question, countdown and results, never the streamer's secret choice. */
export function QuizBroadcast({ state, now, cats, chosen, busy, onPick, onShow, onFinish, onBoard, onEnd }: BroadcastProps) {
  const rows = standings(state).slice(0, 10);
  const r = state.round;
  const q = r?.question;
  const result = state.result;
  const left = state.deadline ? Math.max(0, Math.ceil((state.deadline - now) / 1000)) : null;
  const swappers = r ? Object.values(r.choices).filter((c) => c === 'swap').length : 0;
  const answerers = r ? Object.values(r.choices).filter((c) => c === 'answer').length : 0;
  const answered = r ? Object.keys(r.picks).length : 0;
  const header = q && (
    <div className="mb-3 flex items-center justify-between text-sm">
      <span className="rounded-full bg-q-gold/15 px-3 py-1 font-black text-q-gold">{q.points} نقطة{q.categoryName ? ` · ${q.categoryName}` : ''}</span>
      {left !== null && state.phase !== 'streamer' && <span className="text-2xl font-black tabular-nums text-q-cyan">⏱ {left}</span>}
    </div>
  );

  return (
    <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-[1fr_18rem]">
      <div className="q-card">
        {state.phase === 'lobby' && (
          <div className="py-10 text-center">
            <div className="mb-2 text-5xl">🎮</div>
            <div className="text-3xl font-black text-q-gold">جاوب أو بادل</div>
            <div className="mt-3 text-xl">اكتبوا <b className="text-q-gold">دخول</b> في الشات عشان تلعبون</div>
          </div>
        )}

        {state.phase === 'board' && (
          <div>
            <div className="mb-1 text-center text-lg font-black">اختر سؤال من اللوحة</div>
            <div className="mb-3 text-center text-sm text-white/60">اكتبوا <b className="text-q-gold">دخول</b> في الشات للمشاركة · المشاركون: {state.joined.length}</div>
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${chosen.length}, minmax(0, 1fr))` }}>
              {chosen.map((id) => {
                const c = cats.find((x) => x.id === id);
                return <div key={id} className="truncate rounded-lg bg-q-panel py-2 text-center text-sm font-black">{c?.icon} {c?.name}</div>;
              })}
              {POINTS.flatMap((p) =>
                chosen.map((id) => {
                  const used = state.used.includes(`${id}:${p}`);
                  return (
                    <button key={`${id}:${p}`} type="button" disabled={used || busy || !onPick} onClick={() => onPick?.(id, p)} className={cn('rounded-lg border-2 py-4 text-xl font-black', used ? 'border-transparent bg-white/5 text-white/15' : 'border-q-line bg-q-panel text-q-gold hover:border-q-gold')}>
                      {p}
                    </button>
                  );
                }),
              )}
            </div>
            {onEnd && <button type="button" className="mt-3 w-full text-xs text-white/40 underline" onClick={onEnd}>إنهاء اللعبة وعرض الفائز</button>}
          </div>
        )}

        {state.phase === 'streamer' && q && (
          <div className="py-10 text-center">
            <div className="mb-2 text-sm text-q-gold">{q.points} نقطة{q.categoryName ? ` · ${q.categoryName}` : ''}</div>
            <div className="mb-2 text-5xl">🎙️</div>
            <div className="text-3xl font-black">الستريمر يختار جوابه...</div>
            <div className="mt-2 text-white/60">جهزوا أنفسكم، السؤال جاي لكم</div>
          </div>
        )}

        {state.phase === 'choose' && q && (
          <div className="py-2 text-center">
            {header}
            <QuestionImage url={q.imageUrl} type={q.type ?? 'text'} large />
            <div className="mb-4 text-3xl font-black leading-snug">{q.text}</div>
            <div className="mx-auto mb-3 max-w-md space-y-1 rounded-xl bg-q-panel p-4 text-2xl">
              <div>اكتبوا <b className="text-q-gold">1</b> = جاوب</div>
              <div>اكتبوا <b className="text-q-cyan">2</b> = بادل مع الستريمر</div>
            </div>
            <div className="text-sm text-white/70">✅ جاوب: {answerers} · 🔄 بادل: {swappers}</div>
            {onShow && <button type="button" className="q-btn-gold mt-3" onClick={onShow}>اعرض الخيارات الآن</button>}
          </div>
        )}

        {(state.phase === 'answer' || state.phase === 'result') && q && (
          <div>
            {header}
            <QuestionImage url={result && q.revealUrl ? q.revealUrl : q.imageUrl} type={q.type ?? 'text'} revealed={Boolean(result)} large />
            <div className="mb-4 text-center text-3xl font-black leading-snug">{q.text}</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {q.options.map((o, i) => (
                <div key={i} className={cn('flex items-center gap-2 rounded-xl border-2 p-4 text-start text-xl font-black', result && i === result.correctIndex ? 'border-q-green bg-q-green/15' : 'border-q-line bg-q-panel')}>
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-q-gold/15 text-q-gold">{i + 1}</span>
                  {o}
                </div>
              ))}
            </div>
            {state.phase === 'answer' && (
              <div className="mt-3 text-center text-sm text-white/70">
                اكتبوا رقم الخيار (1-4) · أجاب {answered} · بادل {swappers}
                {onFinish && <div><button type="button" className="q-btn-gold mt-3" onClick={onFinish}>أنهِ السؤال وأظهر الجواب</button></div>}
              </div>
            )}
            {result && (
              <div className="mt-4 text-center">
                <div className="text-xl font-black">
                  {result.streamerChoice === 'swap' ? `الستريمر بادل مع ${displayName(state, result.streamerPartner ?? '')}` : 'الستريمر جاوب'} —{' '}
                  <span className={result.streamerCorrect ? 'text-q-green' : 'text-q-red'}>{result.streamerPick === null ? 'بدون جواب' : result.streamerCorrect ? 'صح ✅' : 'غلط ❌'}</span>
                </div>
                {onBoard && <button type="button" className="q-btn-gold mt-3" onClick={onBoard}>اللوحة ◀</button>}
              </div>
            )}
          </div>
        )}

        {state.phase === 'over' && (
          <div className="py-10 text-center">
            <div className="mb-2 text-5xl">🏆</div>
            <div className="text-4xl font-black text-q-gold">الفائز: {rows[0]?.name}</div>
            <div className="mt-1 text-white/60">{rows[0]?.score} نقطة</div>
          </div>
        )}
      </div>

      <div className="q-card">
        <div className="mb-2 text-lg font-black text-q-gold">{state.phase === 'result' ? 'أفضل 10 بعد هذا السؤال' : 'أفضل 10'}</div>
        <ol className="space-y-2 text-base">
          {rows.map((row, i) => {
            const o = state.phase === 'result' && row.outcome ? OUTCOME[row.outcome] : null;
            const took = row.taken > 0;
            return (
              <li key={row.key}>
                <div className="flex justify-between gap-2">
                  <span className="truncate">{i + 1}. {row.name}{row.streamer ? ' 🎙️' : ''}</span>
                  <bdi dir="ltr" className="font-black tabular-nums">{row.score}</bdi>
                </div>
                {o && (
                  <div className={cn('text-xs', o.cls)}>
                    {o.label} {took ? <bdi dir="ltr">{row.taken}</bdi> : <bdi dir="ltr">{row.delta > 0 ? `+${row.delta}` : row.delta}</bdi>}
                  </div>
                )}
                {state.phase === 'result' && row.swappedWith.length > 0 && (
                  <div className="text-xs text-q-cyan">🔄 بادل معه: {names(state, row.swappedWith)}{took ? ' — راحت نقاطه' : ''}</div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
