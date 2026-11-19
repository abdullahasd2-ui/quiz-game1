import type { DuelLive, DuelStats, KickLiveStream } from '@quiz/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { PageHeader } from '../AdminLayout';
import { BarList, ChartCard, DailyBars, num, PERIODS, Stat } from './StatsPage';

const VARIANT: Record<string, string> = { swap: 'جاوب أو بادل', flip: 'جاوب أو اقلب', triple: 'جاوب أو بادل أو اعكس', hide: 'خبّي أو اكشف', list: 'عدّها' };
const PHASE: Record<string, string> = {
  lobby: 'ينتظر المشاركين',
  board: 'يختار سؤال',
  streamer: 'دور الستريمر',
  choose: 'الشات يختار',
  shuffle: 'خلط الصناديق',
  answer: 'الشات يجاوب',
  steal: 'سرقة نقاط',
  result: 'النتيجة',
};
const when = new Intl.DateTimeFormat('ar-u-nu-latn', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Riyadh' });

/** Kick stream mode: who linked their account, stream sessions, viewers who joined with «دخول», and the streams live now. */
export function KickStatsPage() {
  const [days, setDays] = useState<number>(30);
  const q = useQuery({ queryKey: ['stats', 'kick', days], queryFn: () => api.kickStats(days), refetchInterval: 10_000 });
  const k = q.data;
  const t = k?.totals;
  const loading = q.isPending;

  return (
    <>
      <PageHeader title="بث Kick" description="الستريمرز اللي ربطوا حساباتهم، البثوث، والمشاهدين اللي دخلوا اللعب" />

      <section className="mb-10">
        <div className="mb-3 flex items-center gap-2">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
          </span>
          <h2 className="text-lg font-semibold">البثوث الشغّالة الحين</h2>
          <Badge variant="secondary">{k?.live.length ?? 0}</Badge>
        </div>
        {loading ? <Skeleton className="h-24 w-full" /> : <LiveTable rows={k?.live ?? []} />}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">خلال الفترة</h2>
            <p className="text-xs text-muted-foreground">البثوث والألعاب بدون «تجربة بدون Kick» — المشاركين يشملون التجربة</p>
          </div>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-36" aria-label="الفترة"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => <SelectItem key={p} value={String(p)}>آخر {p} يوم</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="ربط حساب Kick" value={t?.links} hint={t && `${num.format(t.channels)} قناة مختلفة`} loading={loading} />
          <Stat label="بثوث بدأت" value={t?.realStreams} hint={t && `+${num.format(t.streams - t.realStreams)} بوضع التجربة`} loading={loading} />
          <Stat
            label="المشاركين"
            value={t?.joins}
            hint={t && `اللي كتبوا «دخول» · أكثر بث: ${num.format(t.maxPlayers)}${t.testJoins ? ` · منهم ${num.format(t.testJoins)} بالتجربة` : ''}`}
            loading={loading}
          />
          <Stat label="ألعاب اكتملت" value={t?.finished} hint={t && `${num.format(t.gamesStarted)} بدأت · ${num.format(t.rounds)} جولة`} loading={loading} />
        </div>

        <div className="mb-4 grid gap-4 lg:grid-cols-2">
          <ChartCard title="البثوث باليوم" description="بدون وضع التجربة" loading={loading}>
            <DailyBars days={k?.byDay ?? []} value={(d) => d.streams} unit="بث" />
          </ChartCard>
          <ChartCard title="المشاركين باليوم" description="اللي كتبوا «دخول» في كل البثوث" loading={loading}>
            <DailyBars days={k?.byDay ?? []} value={(d) => d.joins} unit="مشارك" />
          </ChartCard>
        </div>

        <div className="mb-4 grid gap-4 lg:grid-cols-2">
          <ChartCard title="أكثر القنوات" description="حسب عدد المشاركين" loading={loading}>
            <BarList
              rows={(k?.topChannels ?? []).map((c) => ({ key: c.channel, label: `${c.channel} · ${num.format(c.streams)} بث`, value: c.joins }))}
              empty="ما فيه بثوث للحين"
              share={false}
            />
          </ChartCard>
          <ChartCard title="الأطوار" description="البثوث اللي بدأت فيها اللعبة" loading={loading}>
            <BarList rows={(k?.variants ?? []).map((v) => ({ key: v.variant, label: VARIANT[v.variant] ?? v.variant, value: v.streams }))} empty="ما فيه ألعاب للحين" />
          </ChartCard>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>آخر البثوث</CardTitle>
            <CardDescription>آخر 15 جلسة، ومنها التجربة</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-40 w-full" />
            ) : !k?.recent.length ? (
              <p className="py-6 text-center text-sm text-muted-foreground">ما فيه بثوث للحين</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>القناة</TableHead>
                    <TableHead>الطور</TableHead>
                    <TableHead>المشاركين</TableHead>
                    <TableHead>الجولات</TableHead>
                    <TableHead>البداية</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {k.recent.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium" dir="ltr">
                        {r.channel} {r.test && <Badge variant="outline" className="ms-1">تجربة</Badge>}
                      </TableCell>
                      <TableCell>{r.variant ? VARIANT[r.variant] ?? r.variant : '—'}</TableCell>
                      <TableCell className="tabular-nums">{num.format(r.players)}</TableCell>
                      <TableCell className="tabular-nums">{num.format(r.rounds)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{when.format(new Date(r.startedAt))}</TableCell>
                      <TableCell>{r.finishedAt ? <Badge>اكتملت</Badge> : r.variant ? <Badge variant="secondary">ما كمّلت</Badge> : <Badge variant="outline">ما بدأت</Badge>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>

      <DuelSection d={k?.duels} loading={loading} />
    </>
  );
}

const DUEL_MODE: Record<string, string> = { castle: '🏰 القلعة', faza: '⚡ الفزعة', chain: '⛓️ السلسلة' };
const winnerLabel = (w: string | null, a: string, b: string) => (w === 'a' ? a : w === 'b' ? b : w === 'draw' ? 'تعادل' : '—');

/** «تحدي القنوات»: the challenges open now, the period's numbers, the modes, and the last challenges. */
function DuelSection({ d, loading }: { d: DuelStats | undefined; loading: boolean }) {
  const t = d?.totals;
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-lg font-semibold">⚔️ تحدي القنوات</h2>
        <Badge variant="secondary">{d?.live.length ?? 0} شغّال الحين</Badge>
      </div>
      {loading ? <Skeleton className="h-24 w-full" /> : <DuelLiveCards rows={d?.live ?? []} />}

      <div className="my-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="تحديات انفتحت" value={t?.real} hint={t && `+${num.format(t.duels - t.real)} بوضع التجربة`} loading={loading} />
        <Stat label="بدأت فيها اللعبة" value={t?.started} hint={t && `${num.format(t.finished)} اكتملت · ${num.format(t.rounds)} سؤال`} loading={loading} />
        <Stat label="بث واحد" value={t?.single} hint="شات واحد انقسم فريقين" loading={loading} />
        <Stat label="اللاعبين" value={t?.players} hint={t && `أكثر تحدي: ${num.format(t.maxPlayers)} لاعب`} loading={loading} />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title="الأطوار" description="التحديات اللي بدأت فيها اللعبة، بدون التجربة" loading={loading}>
          <BarList
            rows={(d?.modes ?? []).map((m) => ({ key: `${m.mode}:${m.single}`, label: `${DUEL_MODE[m.mode] ?? m.mode} · ${m.single ? 'بث واحد' : 'بثين'}`, value: m.duels }))}
            empty="ما فيه تحديات للحين"
          />
        </ChartCard>
        <Card>
          <CardHeader>
            <CardTitle>آخر التحديات</CardTitle>
            <CardDescription>آخر 15 تحدي، ومنها التجربة</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-40 w-full" />
            ) : !d?.recent.length ? (
              <p className="py-6 text-center text-sm text-muted-foreground">ما فيه تحديات للحين</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الأزرق ضد الأحمر</TableHead>
                    <TableHead>الطور</TableHead>
                    <TableHead>اللاعبين</TableHead>
                    <TableHead>الفايز</TableHead>
                    <TableHead>البداية</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.recent.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">
                        <span dir="ltr">{r.channelA}</span> ⚔️ <span dir="ltr">{r.single ? `👑 ${r.channelB || '—'}` : r.channelB}</span>
                        {r.test && <Badge variant="outline" className="ms-1">تجربة</Badge>}
                      </TableCell>
                      <TableCell className="text-xs">
                        {DUEL_MODE[r.mode] ?? r.mode}
                        <div className="text-muted-foreground">{r.single ? 'بث واحد' : 'بثين'}</div>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {num.format(r.playersA)} · {num.format(r.playersB)}
                      </TableCell>
                      <TableCell>{r.finishedAt ? <Badge>{winnerLabel(r.winner, r.channelA, r.single ? `👑 ${r.channelB}` : r.channelB)}</Badge> : <Badge variant="secondary">ما كمّل</Badge>}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{when.format(new Date(r.startedAt))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function DuelLiveCards({ rows }: { rows: DuelLive[] }) {
  if (!rows.length) return <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">ما فيه تحدي شغّال الحين</p>;
  const unit = (mode: string) => (mode === 'castle' ? '❤️' : mode === 'faza' ? 'جولة' : 'نقطة');
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((r) => (
        <Card key={r.code}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              <span>
                {DUEL_MODE[r.mode] ?? r.mode} {r.test && <Badge variant="outline">تجربة</Badge>}
              </span>
              <Badge variant="secondary">{r.single ? 'بث واحد' : 'بثين'}</Badge>
            </CardTitle>
            <CardDescription>
              {r.phase === 'lobby' ? 'في اللوبي' : r.phase === 'over' ? `انتهى · ${winnerLabel(r.winner, r.channels.a, r.channels.b)}` : `السؤال ${num.format(r.rounds + (r.phase === 'question' ? 1 : 0))}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            {(['a', 'b'] as const).map((t) => (
              <div key={t} className={t === 'a' ? 'text-sky-600 dark:text-sky-300' : 'text-rose-600 dark:text-rose-300'}>
                <div className="truncate font-semibold" dir="ltr">
                  {r.channels[t]}
                </div>
                <div className="text-xs text-muted-foreground">
                  {num.format(r.players[t])} لاعب · {num.format(r.score[t])} {unit(r.mode)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function LiveTable({ rows }: { rows: KickLiveStream[] }) {
  if (!rows.length) return <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">ما فيه بث شغّال الحين</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((r) => (
        <Card key={r.channel + r.since}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              <span dir="ltr" className="truncate">{r.channel}</span>
              {r.test && <Badge variant="outline">تجربة</Badge>}
            </CardTitle>
            <CardDescription>
              {r.variant ? VARIANT[r.variant] ?? r.variant : 'قبل البداية'} · {PHASE[r.phase] ?? r.phase}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-6 text-sm">
            <div><div className="text-2xl font-semibold tabular-nums">{num.format(r.players)}</div><div className="text-xs text-muted-foreground">مشارك</div></div>
            <div><div className="text-2xl font-semibold tabular-nums">{r.rounds}/{r.totalRounds || '—'}</div><div className="text-xs text-muted-foreground">جولة</div></div>
            <div><div className="text-2xl font-semibold tabular-nums">{Math.max(1, Math.round((Date.now() - r.since) / 60000))}</div><div className="text-xs text-muted-foreground">دقيقة</div></div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
