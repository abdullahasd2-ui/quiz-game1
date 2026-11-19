import type { RoomMode, UsageDay, UsageStats, Variant } from '@quiz/shared';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const num = new Intl.NumberFormat('en');
const dayLabel = new Intl.DateTimeFormat('ar-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const fmtDay = (day: string) => dayLabel.format(new Date(`${day}T00:00:00Z`));

const VARIANT: Record<Variant, { label: string; icon: string; color: string }> = {
  swap: { label: 'جاوب أو بادل', icon: '🔄', color: '#38bdf8' },
  flip: { label: 'جاوب أو اقلب', icon: '🔀', color: '#a855f7' },
  triple: { label: 'جاوب أو بادل أو اعكس', icon: '↩️', color: '#f7c948' },
  hide: { label: 'خبّي أو اكشف', icon: '📦', color: '#22c55e' },
  list: { label: 'عدّها', icon: '⏱️', color: '#f472b6' },
};
const MODE: Record<RoomMode, { label: string; icon: string }> = { mobile: { label: 'جوال', icon: '📱' }, tv: { label: 'تلفاز', icon: '📺' } };
const MEDAL = ['🥇', '🥈', '🥉'];
const PODIUM_H = ['h-28', 'h-20', 'h-14'];
const PODIUM_TONE = [
  'from-amber-300/90 to-amber-600/80 text-amber-950',
  'from-slate-200/90 to-slate-400/80 text-slate-900',
  'from-orange-300/90 to-orange-700/80 text-orange-950',
];

/** A leader card: the winner big, then a podium for the top three. */
function Champion({
  title,
  icon,
  winner,
  winnerNote,
  share,
  podium,
  accent,
}: {
  title: string;
  icon: string;
  winner: string;
  winnerNote: string;
  share: number | null;
  podium: { key: string; label: string; icon?: string; value: number }[];
  accent: string;
}) {
  // Podium order on screen: 2nd · 1st · 3rd.
  const order = [podium[1], podium[0], podium[2]];
  return (
    <Card className="relative overflow-hidden p-0">
      <div className="pointer-events-none absolute -end-16 -top-16 size-56 rounded-full opacity-25 blur-3xl" style={{ background: accent }} />
      <div className="relative p-5">
        <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
          <span>{icon}</span>
          {title}
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[11px] font-bold text-amber-300">
              👑 الأكثر استخدامًا
            </div>
            <div className="truncate text-2xl font-black sm:text-3xl" style={{ color: accent }}>
              {winner}
            </div>
            <div className="text-xs text-muted-foreground">{winnerNote}</div>
          </div>
          {share !== null && <Ring value={share} color={accent} />}
        </div>

        <div className="mt-5 flex items-end justify-center gap-2" dir="rtl">
          {order.map((p, i) => {
            const rank = i === 1 ? 0 : i === 0 ? 1 : 2;
            if (!p) return <div key={i} className="w-1/3" />;
            return (
              <div key={p.key} className="flex w-1/3 flex-col items-center">
                <div className="mb-1 text-2xl">{MEDAL[rank]}</div>
                <div className="mb-1 line-clamp-2 min-h-8 text-center text-xs font-bold leading-4">
                  {p.icon && <span className="me-0.5">{p.icon}</span>}
                  {p.label}
                </div>
                <div
                  className={cn(
                    'flex w-full flex-col items-center justify-start rounded-t-xl bg-gradient-to-b pt-2 font-black shadow-lg',
                    PODIUM_H[rank],
                    PODIUM_TONE[rank],
                  )}
                >
                  <span className="text-lg tabular-nums">{num.format(p.value)}</span>
                  <span className="text-[10px] font-bold opacity-70">لعبة</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

/** Share as a ring, the percent in the middle. */
function Ring({ value, color, size = 84 }: { value: number; color: string; size?: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" className="shrink-0 -rotate-90" role="img" aria-label={`${value}٪`}>
      <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted" />
      <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`} />
      <text x="40" y="40" textAnchor="middle" dominantBaseline="central" className="fill-foreground text-[15px] font-black" transform="rotate(90 40 40)">
        {value}٪
      </text>
    </svg>
  );
}

/** The two leaders side by side: game mode and category. */
export function Champions({ u }: { u: UsageStats }) {
  const byVariant = new Map<Variant, { games: number; mobile: number; tv: number }>();
  for (const m of u.modes) {
    const v = byVariant.get(m.variant) ?? { games: 0, mobile: 0, tv: 0 };
    v.games += m.games;
    v[m.mode] += m.games;
    byVariant.set(m.variant, v);
  }
  const variants = [...byVariant.entries()].sort((a, b) => b[1].games - a[1].games);
  const totalGames = variants.reduce((n, [, v]) => n + v.games, 0);
  const top = variants[0];
  const cats = u.topCategories;
  const topCat = cats[0];

  if (!top && !topCat) return null;
  return (
    <div className="mb-4 grid gap-4 lg:grid-cols-2">
      {top && (
        <Champion
          title="أكثر طور يلعبونه"
          icon="🎮"
          accent={VARIANT[top[0]].color}
          winner={`${VARIANT[top[0]].icon} ${VARIANT[top[0]].label}`}
          winnerNote={`${num.format(top[1].games)} لعبة · ${MODE.mobile.icon} ${num.format(top[1].mobile)} جوال · ${MODE.tv.icon} ${num.format(top[1].tv)} تلفاز`}
          share={totalGames ? Math.round((top[1].games / totalGames) * 100) : null}
          podium={variants.slice(0, 3).map(([v, s]) => ({ key: v, label: VARIANT[v].label, icon: VARIANT[v].icon, value: s.games }))}
        />
      )}
      {topCat && (
        <Champion
          title="أكثر فئة يختارونها"
          icon="🗂️"
          accent="#a855f7"
          winner={topCat.name}
          winnerNote={`انختارت في ${num.format(topCat.games)} لعبة${totalGames ? ` — يعني ${Math.round((topCat.games / totalGames) * 100)}٪ من الألعاب` : ''}`}
          share={totalGames ? Math.min(100, Math.round((topCat.games / totalGames) * 100)) : null}
          podium={cats.slice(0, 3).map((c) => ({ key: String(c.categoryId), label: c.name, value: c.games }))}
        />
      )}
    </div>
  );
}

/** Modes as a donut by game, with the phone/TV split under it. */
export function ModesDonut({ u }: { u: UsageStats }) {
  const byVariant = new Map<Variant, number>();
  let mobile = 0;
  let tv = 0;
  let solo = 0;
  for (const m of u.modes) {
    byVariant.set(m.variant, (byVariant.get(m.variant) ?? 0) + m.games);
    if (m.solo) solo += m.games;
    if (m.mode === 'mobile') mobile += m.games;
    else tv += m.games;
  }
  const rows = [...byVariant.entries()].sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((n, [, v]) => n + v, 0);
  if (!total) return <p className="py-6 text-center text-sm text-muted-foreground">لم تبدأ أي لعبة بعد</p>;
  const r = 32;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div>
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 80 80" className="size-32 shrink-0 -rotate-90">
          {rows.map(([v, n]) => {
            const len = (n / total) * c;
            const el = <circle key={v} cx="40" cy="40" r={r} fill="none" stroke={VARIANT[v].color} strokeWidth="12" strokeDasharray={`${Math.max(len - 1.5, 0.5)} ${c}`} strokeDashoffset={-offset} />;
            offset += len;
            return el;
          })}
          <text x="40" y="37" textAnchor="middle" transform="rotate(90 40 40)" className="fill-foreground text-[14px] font-black">{num.format(total)}</text>
          <text x="40" y="49" textAnchor="middle" transform="rotate(90 40 40)" className="fill-muted-foreground text-[7px]">لعبة</text>
        </svg>
        <ul className="flex-1 space-y-2 text-sm">
          {rows.map(([v, n], i) => (
            <li key={v} className="flex items-center gap-2">
              <span className="size-3 shrink-0 rounded-sm" style={{ background: VARIANT[v].color }} />
              <span className="flex-1 truncate">
                {i === 0 && '👑 '}
                {VARIANT[v].label}
              </span>
              <b className="tabular-nums">{Math.round((n / total) * 100)}٪</b>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>📱 جوال {Math.round((mobile / total) * 100)}٪</span>
          <span>📺 تلفاز {Math.round((tv / total) * 100)}٪</span>
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
          <div className="bg-sky-400" style={{ width: `${(mobile / total) * 100}%` }} />
          <div className="bg-fuchsia-500" style={{ width: `${(tv / total) * 100}%` }} />
        </div>
      </div>
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>👥 فريقين {Math.round(((total - solo) / total) * 100)}٪</span>
          <span>🙋 فردي {Math.round((solo / total) * 100)}٪</span>
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
          <div className="bg-amber-400" style={{ width: `${((total - solo) / total) * 100}%` }} />
          <div className="bg-cyan-400" style={{ width: `${(solo / total) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

/** Categories as a ranked board: medals for the top three, a heat bar for the rest. */
export function CategoryBoard({ u }: { u: UsageStats }) {
  const cats = u.topCategories;
  if (!cats.length) return <p className="py-6 text-center text-sm text-muted-foreground">لم تبدأ أي لعبة بعد</p>;
  const max = cats[0]!.games;
  return (
    <ol className="space-y-1.5">
      {cats.map((c, i) => (
        <li key={c.categoryId} className={cn('relative overflow-hidden rounded-lg px-3 py-2', i === 0 ? 'bg-amber-400/10 ring-1 ring-amber-400/40' : 'bg-muted/40')}>
          <div
            className="absolute inset-y-0 start-0 bg-gradient-to-l from-primary/35 to-primary/5"
            style={{ width: `${(c.games / max) * 100}%` }}
          />
          <div className="relative flex items-center gap-2 text-sm">
            <span className="w-6 text-center">{MEDAL[i] ?? <span className="text-xs text-muted-foreground">{i + 1}</span>}</span>
            <span className={cn('flex-1 truncate', i < 3 && 'font-bold')}>{c.name}</span>
            <b className="tabular-nums">{num.format(c.games)}</b>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Records in the period: the busiest day, the longest run of days with games, the busiest weekday. */
export function Records({ days }: { days: UsageDay[] }) {
  if (!days.length) return null;
  const best = days.reduce((a, d) => (d.visitors > a.visitors ? d : a), days[0]!);
  const bestGames = days.reduce((a, d) => (d.games > a.games ? d : a), days[0]!);
  let run = 0;
  let longest = 0;
  for (const d of days) {
    run = d.games > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  const WD = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const sums = Array.from({ length: 7 }, () => ({ v: 0, n: 0 }));
  for (const d of days) {
    const w = new Date(`${d.day}T00:00:00Z`).getUTCDay();
    sums[w]!.v += d.visitors;
    sums[w]!.n += 1;
  }
  const avg = sums.map((s) => (s.n ? s.v / s.n : 0));
  const maxAvg = Math.max(1, ...avg);
  const topWd = avg.indexOf(Math.max(...avg));

  const tiles = [
    { icon: '🔥', label: 'أكثر يوم زوار', value: `${num.format(best.visitors)} زائر`, note: fmtDay(best.day), tone: 'from-orange-500/25' },
    { icon: '🎲', label: 'أكثر يوم ألعاب', value: `${num.format(bestGames.games)} غرفة`, note: fmtDay(bestGames.day), tone: 'from-violet-500/25' },
    { icon: '⚡', label: 'أطول سلسلة أيام فيها لعب', value: `${longest} يوم ورا بعض`, note: 'ما وقف اللعب ولا يوم', tone: 'from-sky-500/25' },
  ];
  return (
    <div className="mb-4 grid gap-4 lg:grid-cols-4">
      {tiles.map((t) => (
        <Card key={t.label} className={cn('relative overflow-hidden bg-gradient-to-br to-transparent p-4', t.tone)}>
          <div className="text-2xl">{t.icon}</div>
          <div className="mt-1 text-xs text-muted-foreground">{t.label}</div>
          <div className="text-xl font-black tabular-nums">{t.value}</div>
          <div className="text-[11px] text-muted-foreground">{t.note}</div>
        </Card>
      ))}
      <Card className="p-4">
        <div className="mb-2 text-xs text-muted-foreground">📅 أنشط يوم بالأسبوع: <b className="text-foreground">{WD[topWd]}</b></div>
        <div className="flex h-16 items-end gap-1">
          {avg.map((a, i) => (
            <div key={i} className={cn('w-full flex-1 rounded-t', i === topWd ? 'bg-amber-400' : 'bg-primary/60')} style={{ height: `${Math.max((a / maxAvg) * 100, 4)}%` }} title={`${Math.round(a)} زائر بالمتوسط`} />
          ))}
        </div>
        <div className="mt-1 flex gap-1 text-center text-[9px] text-muted-foreground">
          {WD.map((w, i) => (
            <span key={w} className={cn('flex-1', i === topWd && 'font-bold text-amber-400')}>{w.replace('ال', '').slice(0, 3)}</span>
          ))}
        </div>
      </Card>
    </div>
  );
}
