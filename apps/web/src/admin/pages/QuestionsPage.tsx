import { LEGACY_DRAW_PREFIX, type Question } from '@quiz/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeftIcon, ChevronRightIcon, ImageIcon, PlusIcon, SearchIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { TYPE_LABELS } from '@/lib/labels';
import { PageHeader } from '../AdminLayout';
import { useCategories } from '../useCategories';

const PAGE_SIZE = 25;
const ALL = 'all';

export function QuestionsPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const categories = useCategories();

  const categoryId = params.get('categoryId') ?? ALL;
  const active = params.get('active') ?? ALL;
  const search = params.get('search') ?? '';
  const page = Number(params.get('page') ?? 1);

  const setParam = (key: string, value: string) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value && value !== ALL) next.set(key, value);
      else next.delete(key);
      if (key !== 'page') next.delete('page');
      return next;
    }, { replace: true });

  // Debounce typing into the URL (and therefore into the query).
  const [searchInput, setSearchInput] = useState(search);
  useEffect(() => {
    const t = setTimeout(() => searchInput !== search && setParam('search', searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]); // eslint-disable-line react-hooks/exhaustive-deps

  const filters = {
    categoryId: categoryId === ALL ? undefined : Number(categoryId),
    active: active === ALL ? undefined : active === 'true',
    search: search || undefined,
    page,
    pageSize: PAGE_SIZE,
  };
  const questions = useQuery({ queryKey: ['questions', filters], queryFn: () => api.questions(filters), placeholderData: keepPreviousData });
  const totalPages = Math.max(1, Math.ceil((questions.data?.total ?? 0) / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="الأسئلة"
        description={questions.data ? `${questions.data.total} سؤال` : undefined}
        actions={<Button asChild><Link to="/admin/questions/new"><PlusIcon /> سؤال جديد</Link></Button>}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-56 flex-1">
          <SearchIcon className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="ps-8" placeholder="ابحث في نص السؤال…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
        </div>
        <Select value={categoryId} onValueChange={(v) => setParam('categoryId', v)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>كل الفئات</SelectItem>
            {categories.data?.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.icon} {c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={active} onValueChange={(v) => setParam('active', v)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>كل الحالات</SelectItem>
            <SelectItem value="true">مفعّل</SelectItem>
            <SelectItem value="false">موقوف</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-full">السؤال</TableHead>
              <TableHead>الفئة</TableHead>
              <TableHead className="hidden text-center sm:table-cell">النقاط</TableHead>
              <TableHead className="hidden md:table-cell">النوع</TableHead>
              <TableHead>الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {questions.isPending &&
              Array.from({ length: 6 }, (_, i) => (
                <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-5 w-full" /></TableCell></TableRow>
              ))}
            {questions.data?.items.length === 0 && (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">لا توجد أسئلة مطابقة</TableCell></TableRow>
            )}
            {questions.data?.items.map((q) => (
              <TableRow key={q.id} className="cursor-pointer" onClick={() => navigate(`/admin/questions/${q.id}`)}>
                <TableCell className="max-w-md">
                  <div className="flex items-center gap-2">
                    {q.imageUrl && <ImageIcon className="size-4 shrink-0 text-muted-foreground" />}
                    <Link to={`/admin/questions/${q.id}`} className="truncate font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                      {q.text}
                    </Link>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">✓ {q.options[q.correctIndex]}<span className="sm:hidden"> · {q.points}</span></div>
                </TableCell>
                <TableCell className="whitespace-nowrap">{categories.byId.get(q.categoryId)?.name ?? '—'}</TableCell>
                <TableCell className="hidden text-center tabular-nums sm:table-cell">{q.points}</TableCell>
                <TableCell className="hidden whitespace-nowrap md:table-cell">{TYPE_LABELS[q.type]}</TableCell>
                <TableCell><StatusBadge q={q} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setParam('page', String(page - 1))} aria-label="السابق">
            <ChevronRightIcon />
          </Button>
          <span className="tabular-nums text-muted-foreground">صفحة {page} من {totalPages}</span>
          <Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => setParam('page', String(page + 1))} aria-label="التالي">
            <ChevronLeftIcon />
          </Button>
        </div>
      )}
    </>
  );
}

function StatusBadge({ q }: { q: Question }) {
  if (q.imageUrl?.startsWith(LEGACY_DRAW_PREFIX)) return <Badge variant="destructive">يحتاج صورة</Badge>;
  return q.active ? <Badge variant="secondary">مفعّل</Badge> : <Badge variant="outline">موقوف</Badge>;
}
