import { answerName, displayName, LIST_BONUS, type StreamState } from '@quiz/shared';
import { cn } from '@/lib/utils';

const MEDALS = ['🥇', '🥈', '🥉'];

/** Live «عدّها» round: who has how many so far, and the answers coming in. `big` = the broadcast screen. */
export function ListLive({ state, big = false }: { state: StreamState; big?: boolean }) {
  const list = state.round?.list;
  if (!list) return null;
  const counts = Object.entries(list.found)
    .map(([k, f]) => ({ k, n: f.length, at: list.at[k] ?? 0 }))
    .sort((a, b) => b.n - a.n || a.at - b.at)
    .slice(0, big ? 8 : 6);
  const total = Object.values(list.found).reduce((n, f) => n + f.length, 0);
  return (
    <div className={cn('grid gap-3', big ? 'md:grid-cols-[1fr_16rem]' : 'sm:grid-cols-[1fr_12rem]')}>
      <div className="min-h-24 rounded-2xl border border-q-line bg-q-panel/70 p-3">
        <div className={cn('mb-2 font-black text-white/70', big ? 'text-base' : 'text-xs')}>✍️ الأجوبة الصح ({total})</div>
        <div className="flex flex-wrap-reverse justify-start gap-1.5">
          {list.feed.length === 0 && <div className={cn('text-white/40', big ? 'text-lg' : 'text-sm')}>اكتبوا أجوبتكم في الشات — كل جواب صح نقطة!</div>}
          {[...list.feed].reverse().map((f, i) => (
            <span
              key={`${list.feed.length - i}-${f.k}`}
              className={cn('rounded-lg border border-q-green/40 bg-q-green/10 px-2 py-1 font-black motion-safe:animate-pop-in', big ? 'text-lg' : 'text-xs', i > 0 && 'opacity-75')}
            >
              ✅ {f.text} <span className="font-bold text-white/50">· {displayName(state, f.k)}</span>
            </span>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-q-gold/30 bg-q-gold/5 p-3">
        <div className={cn('mb-2 font-black text-q-gold', big ? 'text-base' : 'text-xs')}>🏁 السباق</div>
        <ol className="space-y-1">
          {counts.length === 0 && <li className="text-sm text-white/40">ما أحد جاوب للحين</li>}
          {counts.map((c, i) => (
            <li key={c.k} className={cn('flex justify-between gap-2', big ? 'text-lg' : 'text-sm')}>
              <span className="truncate">{MEDALS[i] ?? `${i + 1}.`} {displayName(state, c.k)}</span>
              <b className="tabular-nums text-q-gold">{c.n}</b>
            </li>
          ))}
        </ol>
        <div className="mt-2 text-[11px] text-white/50">بونص آخر الوقت: الأول +{LIST_BONUS[0]} · الثاني +{LIST_BONUS[1]} · الثالث +{LIST_BONUS[2]}</div>
      </div>
    </div>
  );
}

/** The end of a round: the top three with their bonus, what the chat found, and some answers nobody said. */
export function ListResult({ state, big = false }: { state: StreamState; big?: boolean }) {
  const res = state.result;
  const r = state.round;
  if (!res || !r?.list) return null;
  const answers = [...(r.question.listAnswers ?? []), ...(r.list.extra ?? [])];
  const winners = Object.entries(res.rows)
    .filter(([, row]) => (row.found ?? 0) > 0)
    .sort((a, b) => (b[1].bonus ?? 0) - (a[1].bonus ?? 0) || (b[1].found ?? 0) - (a[1].found ?? 0))
    .slice(0, 3);
  const said = new Set(Object.values(r.list.found).flat());
  const missed = answers.map((a, i) => ({ a, i })).filter(({ i }) => !said.has(i));
  return (
    <div className="space-y-3">
      <div className={cn('grid gap-2', big ? 'grid-cols-3' : 'grid-cols-3')}>
        {[0, 1, 2].map((p) => {
          const w = winners[p];
          return (
            <div key={p} className={cn('rounded-2xl border-2 p-2 text-center', p === 0 ? 'border-q-gold bg-q-gold/10' : 'border-q-line bg-q-panel')}>
              <div className={big ? 'text-4xl' : 'text-2xl'}>{MEDALS[p]}</div>
              <div className={cn('truncate font-black', big ? 'text-xl' : 'text-sm')}>{w ? displayName(state, w[0]) : '—'}</div>
              {w && (
                <div className={cn('text-white/70', big ? 'text-base' : 'text-xs')}>
                  {w[1].found} جواب <b className="text-q-gold">+{w[1].bonus}</b>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="rounded-2xl border border-q-line bg-q-panel/70 p-3">
        <div className={cn('mb-2 font-black text-q-green', big ? 'text-base' : 'text-xs')}>✅ انذكرت ({said.size} من {answers.length})</div>
        <div className="flex flex-wrap gap-1">
          {[...said].map((i) => (
            <span key={i} className={cn('rounded-md bg-q-green/15 px-1.5 py-0.5 font-bold', big ? 'text-base' : 'text-[11px]')}>{answerName(answers[i] ?? '')}</span>
          ))}
        </div>
        {missed.length > 0 && (
          <>
            <div className={cn('mb-1 mt-3 font-black text-white/60', big ? 'text-base' : 'text-xs')}>🤔 ما أحد ذكرها (من الأجوبة المقبولة)</div>
            <div className="flex flex-wrap gap-1">
              {missed.slice(0, big ? 30 : 24).map(({ a, i }) => (
                <span key={i} className={cn('rounded-md bg-white/5 px-1.5 py-0.5 text-white/60', big ? 'text-base' : 'text-[11px]')}>{answerName(a)}</span>
              ))}
              {missed.length > (big ? 30 : 24) && <span className={cn('px-1 text-white/40', big ? 'text-base' : 'text-[11px]')}>و{missed.length - (big ? 30 : 24)} غيرها…</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Control page only: what the chat typed that isn't on the list — the streamer accepts (a point to all who typed it) or drops it. */
export function UnknownAnswers({ state, onJudge }: { state: StreamState; onJudge: (key: string, accept: boolean) => void }) {
  const unknown = state.round?.list?.unknown ?? {};
  const items = Object.entries(unknown).sort((a, b) => b[1].by.length - a[1].by.length);
  if (!items.length) return null;
  return (
    <div className="mt-3 rounded-2xl border border-q-cyan/30 bg-q-cyan/5 p-3">
      <div className="mb-1 text-sm font-black text-q-cyan">❓ أجوبة مو موجودة في القائمة ({items.length})</div>
      <div className="mb-2 text-[11px] text-white/50">إذا الجواب صح اضغط ✓ وينحسب لكل اللي كتبوه، حتى بعد ما يخلص الوقت. الرقم = كم واحد كتبه.</div>
      <div className="flex max-h-48 flex-wrap gap-1.5 overflow-auto">
        {items.map(([key, u]) => (
          <span key={key} className="flex items-center gap-1 rounded-lg border border-q-line bg-q-panel py-0.5 ps-2 pe-0.5 text-xs font-black">
            {u.text}
            <span className="rounded bg-white/10 px-1 text-[10px] text-white/60">{u.by.length}</span>
            <button type="button" title="جواب صح — احسبه" className="rounded-md bg-q-green/20 px-1.5 text-q-green hover:bg-q-green/35" onClick={() => onJudge(key, true)}>
              ✓
            </button>
            <button type="button" title="غلط — شيله" className="rounded-md px-1.5 text-white/40 hover:bg-q-red/20 hover:text-q-red" onClick={() => onJudge(key, false)}>
              ✕
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
