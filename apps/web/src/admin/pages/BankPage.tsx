import { POINTS, type Question, type QuestionStatus } from '@quiz/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, ExternalLinkIcon, FileUpIcon, PencilIcon, RotateCcwIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { api, errorMessage, type ImportItem } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '../AdminLayout';
import { useCategories } from '../useCategories';

const PAGE_SIZE = 20;
const ALL = 'all';
type Tab = Extract<QuestionStatus, 'pending' | 'rejected'>;

/** Number of proposals waiting for review (shared by the nav badge and the overview). */
export function usePendingCount() {
  const filters = { status: 'pending' as const, pageSize: 1 };
  return useQuery({ queryKey: ['questions', filters], queryFn: () => api.questions(filters), select: (d) => d.total });
}

export function BankPage() {
  const [params, setParams] = useSearchParams();
  const categories = useCategories();
  const queryClient = useQueryClient();

  const tab: Tab = params.get('tab') === 'rejected' ? 'rejected' : 'pending';
  const categoryId = params.get('categoryId') ?? ALL;
  const points = params.get('points') ?? ALL;
  const page = Number(params.get('page') ?? 1);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const setParam = (key: string, value: string) => {
    setSelected(new Set());
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value && value !== ALL) next.set(key, value);
      else next.delete(key);
      if (key !== 'page') next.delete('page');
      return next;
    }, { replace: true });
  };

  const filters = {
    status: tab,
    categoryId: categoryId === ALL ? undefined : Number(categoryId),
    points: points === ALL ? undefined : Number(points),
    page,
    pageSize: PAGE_SIZE,
  };
  const questions = useQuery({ queryKey: ['questions', filters], queryFn: () => api.questions(filters), placeholderData: keepPreviousData });
  const pendingCount = usePendingCount();
  const rejectedFilters = { status: 'rejected' as const, pageSize: 1 };
  const rejectedCount = useQuery({ queryKey: ['questions', rejectedFilters], queryFn: () => api.questions(rejectedFilters), select: (d) => d.total });

  const items = questions.data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil((questions.data?.total ?? 0) / PAGE_SIZE));
  const allSelected = items.length > 0 && items.every((q) => selected.has(q.id));

  const invalidate = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['questions'] }),
    queryClient.invalidateQueries({ queryKey: ['coverage'] }),
  ]);

  const review = useMutation({
    mutationFn: ({ ids, status }: { ids: number[]; status: QuestionStatus }) => api.reviewQuestions(ids, status),
    onSuccess: async ({ updated }, { ids, status }) => {
      setSelected((prev) => new Set([...prev].filter((id) => !ids.includes(id))));
      await invalidate();
      const verb = status === 'approved' ? 'اعتماد' : status === 'rejected' ? 'رفض' : 'إرجاع';
      toast.success(updated === 1 ? `تم ${verb} السؤال` : `تم ${verb} ${updated} سؤال`);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      let data: unknown;
      try {
        data = JSON.parse(await file.text());
      } catch {
        throw new Error('الملف ليس JSON صالحًا');
      }
      const list = Array.isArray(data) ? data : (data as { questions?: unknown })?.questions;
      if (!Array.isArray(list) || list.length === 0) throw new Error('الملف لا يحتوي على قائمة أسئلة');
      return api.importQuestions(list as ImportItem[], { status: 'pending', source: 'upload' });
    },
    onSuccess: async ({ inserted, skipped }) => {
      await invalidate();
      toast.success(`أضيف ${inserted} سؤال للمراجعة${skipped ? `، وتم تجاهل ${skipped} مكرر` : ''}`);
      if (tab !== 'pending') setParam('tab', ALL);
    },
    onError: (err) => toast.error(err instanceof Error && !('status' in err) ? err.message : errorMessage(err)),
  });

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(items.map((q) => q.id)));
  const selectedIds = [...selected];

  return (
    <>
      <PageHeader
        title="بنك الأسئلة"
        description="أسئلة مقترحة (من كوديكس أو من ملف) تنتظر المراجعة. لا يظهر أي سؤال في اللعبة حتى تعتمده."
        actions={
          <Button asChild variant="outline" disabled={upload.isPending}>
            <label className="cursor-pointer">
              <FileUpIcon /> {upload.isPending ? 'جاري الرفع…' : 'رفع ملف مقترحات'}
              <input type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ''; }} />
            </label>
          </Button>
        }
      />

      <div className="mb-4 inline-flex rounded-lg border bg-muted/40 p-1" role="tablist">
        <TabButton active={tab === 'pending'} onClick={() => setParam('tab', ALL)} label="بانتظار المراجعة" count={pendingCount.data} />
        <TabButton active={tab === 'rejected'} onClick={() => setParam('tab', 'rejected')} label="مرفوضة" count={rejectedCount.data} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={categoryId} onValueChange={(v) => setParam('categoryId', v)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>كل الفئات</SelectItem>
            {categories.data?.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.icon} {c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={points} onValueChange={(v) => setParam('points', v)}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>كل النقاط</SelectItem>
            {POINTS.map((p) => <SelectItem key={p} value={String(p)}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {items.length > 0 && (
        <div className="sticky top-0 z-10 -mx-1 mb-3 flex flex-wrap items-center gap-2 rounded-lg border bg-background/95 px-3 py-2 backdrop-blur">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-primary" checked={allSelected} onChange={toggleAll} />
            تحديد الكل في الصفحة
          </label>
          <span className="text-sm text-muted-foreground">{selected.size > 0 && `· ${selected.size} محدد`}</span>
          <div className="ms-auto flex gap-2">
            {tab === 'pending' ? (
              <>
                <Button size="sm" disabled={!selected.size || review.isPending} onClick={() => review.mutate({ ids: selectedIds, status: 'approved' })}>
                  <CheckIcon /> اعتماد المحدد
                </Button>
                <Button size="sm" variant="outline" className="text-destructive" disabled={!selected.size || review.isPending} onClick={() => review.mutate({ ids: selectedIds, status: 'rejected' })}>
                  <XIcon /> رفض المحدد
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" disabled={!selected.size || review.isPending} onClick={() => review.mutate({ ids: selectedIds, status: 'pending' })}>
                <RotateCcwIcon /> إرجاع للمراجعة
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-3">
        {questions.isPending && Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-40 w-full" />)}
        {questions.data && items.length === 0 && (
          <Card className="py-12 text-center text-muted-foreground">
            {tab === 'pending' ? 'لا توجد أسئلة بانتظار المراجعة' : 'لا توجد أسئلة مرفوضة'}
          </Card>
        )}
        {items.map((q) => (
          <ProposalCard
            key={q.id}
            q={q}
            tab={tab}
            categoryLabel={(() => { const c = categories.byId.get(q.categoryId); return c ? `${c.icon} ${c.name}` : '—'; })()}
            selected={selected.has(q.id)}
            onToggle={() => toggle(q.id)}
            busy={review.isPending}
            onReview={(status) => review.mutate({ ids: [q.id], status })}
          />
        ))}
      </div>

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

function TabButton({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count?: number }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn('rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors', active && 'bg-background text-foreground shadow-sm')}
    >
      {label}
      {count !== undefined && <span className="ms-1.5 tabular-nums text-muted-foreground">({count})</span>}
    </button>
  );
}

function ProposalCard({ q, tab, categoryLabel, selected, onToggle, busy, onReview }: {
  q: Question;
  tab: Tab;
  categoryLabel: string;
  selected: boolean;
  onToggle: () => void;
  busy: boolean;
  onReview: (status: QuestionStatus) => void;
}) {
  return (
    <Card className={cn('gap-3 p-4 transition-colors', selected && 'border-primary/60 bg-primary/5')}>
      <div className="flex items-start gap-3">
        <input type="checkbox" className="mt-1 size-4 shrink-0 accent-primary" checked={selected} onChange={onToggle} aria-label="تحديد السؤال" />
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{categoryLabel}</Badge>
            <Badge variant="outline" className="tabular-nums">{q.points}</Badge>
            {q.source && <Badge variant="outline" className="text-muted-foreground">{q.source === 'codex' ? 'كوديكس' : q.source === 'upload' ? 'ملف مرفوع' : q.source}</Badge>}
          </div>
          <p className="font-semibold leading-relaxed">{q.text}</p>
        </div>
      </div>

      <div className="grid gap-1.5 sm:grid-cols-2 sm:ps-7">
        {q.options.map((o, i) => {
          const correct = i === q.correctIndex;
          return (
            <div key={i} className={cn('flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm', correct ? 'border-emerald-500 bg-emerald-500/10 font-semibold text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground')}>
              {correct ? <CheckIcon className="size-4 shrink-0" /> : <span className="size-4 shrink-0" />}
              {o}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:ps-7">
        <Reference value={q.reference} />
        <div className="ms-auto flex gap-1.5">
          {tab === 'pending' ? (
            <>
              <Button size="sm" disabled={busy} onClick={() => onReview('approved')}><CheckIcon /> اعتماد</Button>
              <Button size="sm" variant="outline" asChild><Link to={`/admin/questions/${q.id}`}><PencilIcon /> تعديل</Link></Button>
              <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={() => onReview('rejected')}><XIcon /> رفض</Button>
            </>
          ) : (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onReview('pending')}><RotateCcwIcon /> إرجاع للمراجعة</Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function Reference({ value }: { value: string | null }) {
  if (!value) return <span className="text-xs text-amber-600 dark:text-amber-400">بدون مرجع — تحقّق من الإجابة بنفسك</span>;
  if (/^https?:\/\//.test(value)) {
    let label = value;
    try {
      const url = new URL(value);
      label = decodeURIComponent(url.hostname + url.pathname).replace(/\/$/, '');
    } catch { /* keep the raw value */ }
    return (
      <a href={value} target="_blank" rel="noreferrer" dir="ltr" className="flex min-w-0 max-w-full items-center gap-1 text-xs text-primary hover:underline">
        <ExternalLinkIcon className="size-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </a>
    );
  }
  return <span className="text-xs text-muted-foreground">المرجع: {value}</span>;
}
