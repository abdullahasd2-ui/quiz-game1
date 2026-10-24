import type { LiveRoom, Platform, RoomMode, UsageDay, Variant } from '@quiz/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '../AdminLayout';

const LIVE_REFRESH_MS = 5000;
const PERIODS = [7, 30, 90] as const;

const num = new Intl.NumberFormat('en');
const dayLabel = new Intl.DateTimeFormat('ar-u-nu-latn', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmtDay = (day: string) => dayLabel.format(new Date(`${day}T00:00:00Z`));

const PLATFORM_LABEL: Record<Platform, string> = { web: 'الموقع', ios: 'iPhone', android: 'Android' };
const MODE_LABEL: Record<RoomMode, string> = { mobile: 'جوال', tv: 'تلفاز' };
const VARIANT_LABEL: Record<Variant, string> = { swap: 'جاوب أو بادل', flip: 'جاوب أو اقلب' };

export function StatsPage() {
  return (
    <>
      <PageHeader title="الإحصائيات" description="ما يحدث في اللعبة الآن، والاستخدام خلال الفترة الماضية" />
      <LiveSection />
      <UsageSection />
    </>
  );
}

// ── Live ─────────────────────────────────────────────────────────────────────

function LiveSection() {
  const live = useQuery({ queryKey: ['stats', 'live'], queryFn: api.live, refetchInterval: LIVE_REFRESH_MS });
  const d = live.data;
  const playing = d?.rooms.filter((r) => r.status === 'playing').length ?? 0;

  return (
    <section className="mb-10">
      <div className="mb-3 flex items-center gap-2">
        <span className="relative flex size-2.5">
          <span className={cn('absolute inline-flex size-full rounded-full bg-emerald-500 opacity-75', !live.isError && 'animate-ping')} />
          <span className={cn('relative inline-flex size-2.5 rounded-full', live.isError ? 'bg-destructive' : 'bg-emerald-500')} />
        </span>
        <h2 className="text-lg font-semibold">الآن</h2>
        <span className="text-xs text-muted-foreground">{live.isError ? 'تعذّر التحديث' : 'يتحدّث كل 5 ثوانٍ'}</span>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="لاعبون داخل الغرف" value={d?.playersInRooms} loading={live.isPending} />
        <Stat label="أجهزة متصلة" value={d?.devicesOnline} hint="داخل غرفة أو في الصفحة الرئيسية" loading={live.isPending} />
        <Stat label="غرف مفتوحة" value={d?.rooms.length} loading={live.isPending} />
        <Stat label="ألعاب جارية" value={playing} loading={live.isPending} />
      </div>
      <Card className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الغرفة</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>الفريقان</TableHead>
              <TableHead>آخر نشاط</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {live.isPending && <TableRow><TableCell colSpan={5}><Skeleton className="h-16 w-full" /></TableCell></TableRow>}
            {d?.rooms.length === 0 && (
              <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">لا توجد غرف مفتوحة الآن</TableCell></TableRow>
            )}
            {d?.rooms.map((r) => <LiveRoomRow key={r.code} room={r} />)}
          </TableBody>
        </Table>
      </Card>
    </section>
  );
}

function LiveRoomRow({ room: r }: { room: LiveRoom }) {
  return (
    <TableRow>
      <TableCell dir="ltr" className="text-end font-mono font-semibold tracking-wider">{r.code}</TableCell>
      <TableCell>
        <div>{VARIANT_LABEL[r.variant]}</div>
        <div className="text-xs text-muted-foreground">{MODE_LABEL[r.mode]}</div>
      </TableCell>
      <TableCell>
        {r.status === 'lobby' && <Badge variant="secondary">في الانتظار</Badge>}
        {r.status === 'done' && <Badge variant="outline">انتهت</Badge>}
        {r.status === 'playing' && (
          <div className="min-w-28">
            <div className="mb-1 text-xs tabular-nums">جولة {r.roundsPlayed} من {r.totalRounds}</div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(r.roundsPlayed / Math.max(r.totalRounds, 1)) * 100}%` }} />
            </div>
          </div>
        )}
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-0.5">
          {r.teams.map((t, i) => (
            <div key={i} className="flex items-center gap-1.5 text-sm">
              <Presence on={Boolean(t?.connected)} />
              {t ? (
                <>
                  <span className="max-w-32 truncate">{t.name}</span>
                  {r.status !== 'lobby' && <span className="tabular-nums text-muted-foreground">{num.format(t.score)}</span>}
                </>
              ) : (
                <span className="text-muted-foreground">ينتظر لاعبًا</span>
              )}
            </div>
          ))}
          {r.tvConnected !== null && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Presence on={r.tvConnected} /> التلفاز</div>
          )}
        </div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{idle(r.idleSeconds)}</TableCell>
    </TableRow>
  );
}

function Presence({ on }: { on: boolean }) {
  return <span className={cn('inline-block size-2 shrink-0 rounded-full', on ? 'bg-emerald-500' : 'bg-muted-foreground/40')} title={on ? 'متصل' : 'غير متصل'} />;
}

function idle(seconds: number) {
  if (seconds < 60) return 'الآن';
  const m = Math.round(seconds / 60);
  return m < 60 ? `منذ ${m} د` : `منذ ${Math.floor(m / 60)} س`;
}

// ── Usage ────────────────────────────────────────────────────────────────────

function UsageSection() {
  const [days, setDays] = useState<number>(30);
  const usage = useQuery({ queryKey: ['stats', 'usage', days], queryFn: () => api.usage(days), refetchInterval: 60_000 });
  const u = usage.data;
  const t = u?.totals;
  const completion = t && t.gamesStarted ? Math.round((t.gamesFinished / t.gamesStarted) * 100) : null;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">الاستخدام</h2>
          {u && (
            <p className="text-xs text-muted-foreground">
              اليوم: {num.format(u.today.visitors)} زائر · {num.format(u.today.visits)} زيارة · {num.format(u.today.games)} غرفة
            </p>
          )}
        </div>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-36" aria-label="الفترة"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => <SelectItem key={p} value={String(p)}>آخر {p} يوم</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="الزوار" value={t?.visitors} hint={t && `${num.format(t.newVisitors)} منهم جدد`} loading={usage.isPending} />
        <Stat label="الزيارات" value={t?.visits} hint="فتح اللعبة، بعد غياب 30 دقيقة على الأقل" loading={usage.isPending} />
        <Stat label="ألعاب بدأت" value={t?.gamesStarted} hint={t && `من ${num.format(t.gamesCreated)} غرفة أُنشئت`} loading={usage.isPending} />
        <Stat label="ألعاب اكتملت" value={t?.gamesFinished} hint={completion === null ? undefined : `${completion}٪ من التي بدأت`} loading={usage.isPending} />
        <Stat
          label="مدة اللعبة"
          value={t ? (t.medianGameMinutes === null ? '—' : `${num.format(t.medianGameMinutes)} د`) : undefined}
          hint="الوسيط، للألعاب المكتملة"
          loading={usage.isPending}
        />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title="الزوار يوميًا" description="أجهزة مختلفة فتحت اللعبة" loading={usage.isPending}>
          {u && <DailyBars days={u.byDay} value={(d) => d.visitors} unit="زائر" />}
        </ChartCard>
        <ChartCard title="الغرف يوميًا" description="غرف أُنشئت (بدأت اللعب أو لا)" loading={usage.isPending}>
          {u && <DailyBars days={u.byDay} value={(d) => d.games} unit="غرفة" />}
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="المنصات" description="الزوار حسب الجهاز" loading={usage.isPending}>
          {u && <BarList rows={u.platforms.map((p) => ({ key: p.platform, label: PLATFORM_LABEL[p.platform], value: p.visitors }))} empty="لا زيارات بعد" />}
        </ChartCard>
        <ChartCard title="طريقة اللعب" description="الألعاب التي بدأت" loading={usage.isPending}>
          {u && (
            <BarList
              rows={u.modes.map((m) => ({ key: `${m.mode}-${m.variant}`, label: `${VARIANT_LABEL[m.variant]} · ${MODE_LABEL[m.mode]}`, value: m.games }))}
              empty="لم تبدأ أي لعبة بعد"
            />
          )}
        </ChartCard>
        <ChartCard title="أكثر الفئات لعبًا" description="عدد الألعاب التي اختارتها" loading={usage.isPending}>
          {u && <BarList rows={u.topCategories.map((c) => ({ key: String(c.categoryId), label: c.name, value: c.games }))} empty="لم تبدأ أي لعبة بعد" share={false} />}
        </ChartCard>
      </div>
    </section>
  );
}

// ── Building blocks ──────────────────────────────────────────────────────────

function Stat({ label, value, hint, loading }: { label: string; value: React.ReactNode; hint?: string; loading: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">
          {loading ? <Skeleton className="h-9 w-16" /> : typeof value === 'number' ? num.format(value) : value ?? '—'}
        </CardTitle>
        {hint && !loading && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardHeader>
    </Card>
  );
}

function ChartCard({ title, description, loading, children }: { title: string; description: string; loading: boolean; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{loading ? <Skeleton className="h-40 w-full" /> : children}</CardContent>
    </Card>
  );
}

/** One series per day; time runs left → right like the dates under it. Hover a day for its value. */
function DailyBars({ days, value, unit }: { days: UsageDay[]; value: (d: UsageDay) => number; unit: string }) {
  const max = Math.max(1, ...days.map(value));
  const ticks = [days[0], days[Math.floor(days.length / 2)], days.at(-1)].filter((d, i, a): d is UsageDay => Boolean(d) && a.indexOf(d) === i);

  return (
    <div dir="ltr">
      <div className="flex h-40 gap-3">
        <div className="flex flex-col justify-between py-0.5 text-end text-[11px] tabular-nums text-muted-foreground">
          <span>{num.format(max)}</span>
          <span>0</span>
        </div>
        <div className="relative flex flex-1 items-end gap-0.5 border-b border-border">
          <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-border" />
          {days.map((d) => {
            const v = value(d);
            return (
              <div key={d.day} className="group relative flex h-full flex-1 items-end justify-center" tabIndex={0} aria-label={`${fmtDay(d.day)}: ${v} ${unit}`}>
                <div
                  className="w-full max-w-6 rounded-t bg-primary transition-opacity group-hover:opacity-80"
                  style={{ height: v ? `max(${(v / max) * 100}%, 3px)` : 0 }}
                />
                <div className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md group-hover:block group-focus:block" dir="rtl">
                  <div className="text-muted-foreground">{fmtDay(d.day)}</div>
                  <div className="font-semibold tabular-nums">{num.format(v)} {unit}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-1.5 flex justify-between ps-9 text-[11px] text-muted-foreground">
        {ticks.map((d) => <span key={d.day}>{fmtDay(d.day)}</span>)}
      </div>
      <table className="sr-only">
        <tbody>{days.map((d) => <tr key={d.day}><td>{d.day}</td><td>{value(d)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

/** `share` shows each row's part of the total; off when rows overlap (a game picks several categories). */
function BarList({ rows, empty, share = true }: { rows: { key: string; label: string; value: number }[]; empty: string; share?: boolean }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value));
  const total = rows.reduce((a, r) => a + r.value, 0);
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate">{r.label}</span>
            <span className="shrink-0 tabular-nums">
              {num.format(r.value)}
              {share && <span className="ms-1 text-xs text-muted-foreground">({Math.round((r.value / total) * 100)}٪)</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
