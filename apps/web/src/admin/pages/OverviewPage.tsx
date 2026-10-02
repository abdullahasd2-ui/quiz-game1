import { POINTS } from '@quiz/shared';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '../AdminLayout';

export function OverviewPage() {
  const coverage = useQuery({ queryKey: ['coverage'], queryFn: api.coverage });
  const rows = coverage.data ?? [];
  const totalActive = rows.reduce((sum, r) => sum + Object.values(r.counts).reduce((a, b) => a + b, 0), 0);
  const playable = rows.filter((r) => POINTS.every((p) => (r.counts[p] ?? 0) > 0)).length;

  return (
    <>
      <PageHeader title="نظرة عامة" description="حالة بنك الأسئلة" />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="الأسئلة المفعّلة" value={totalActive} loading={coverage.isPending} />
        <Stat label="الفئات" value={rows.length} loading={coverage.isPending} />
        <Stat label="فئات جاهزة للعب" value={`${playable} / ${rows.length}`} loading={coverage.isPending} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>تغطية اللوحة</CardTitle>
          <CardDescription>
            عدد الأسئلة المفعّلة لكل فئة ونقاط. الخانة الحمراء تعني أن الفئة لا تظهر في اللعبة حتى يُضاف سؤال لها. اضغط على أي خانة لعرض أسئلتها.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {coverage.isPending ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الفئة</TableHead>
                  {POINTS.map((p) => <TableHead key={p} className="text-center tabular-nums">{p}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.categoryId}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    {POINTS.map((p) => {
                      const n = r.counts[p] ?? 0;
                      return (
                        <TableCell key={p} className="p-1 text-center">
                          <Link
                            to={`/admin/questions?categoryId=${r.categoryId}`}
                            className={cn(
                              'block rounded-md py-1.5 tabular-nums font-semibold transition-opacity hover:opacity-80',
                              n === 0 ? 'bg-destructive/15 text-destructive' : n === 1 ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
                            )}
                          >
                            {n}
                          </Link>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Stat({ label, value, loading }: { label: string; value: React.ReactNode; loading: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{loading ? <Skeleton className="h-9 w-16" /> : value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
