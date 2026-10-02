import { zodResolver } from '@hookform/resolvers/zod';
import { POINTS, questionInput, questionTypes, type Question, type QuestionInput } from '@quiz/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRightIcon, CheckIcon, Trash2Icon } from 'lucide-react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import type { z } from 'zod';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { api, errorMessage } from '@/lib/api';
import { TYPE_LABELS, TYPES_WITH_REVEAL } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { PageHeader } from '../AdminLayout';
import { ImageField } from '../components/ImageField';
import { useCategories } from '../useCategories';

type FormValues = z.input<typeof questionInput>;

const toFormValues = (q: Question): FormValues => ({
  categoryId: q.categoryId, type: q.type, text: q.text, options: q.options, correctIndex: q.correctIndex,
  points: q.points, imageUrl: q.imageUrl, revealUrl: q.revealUrl, active: q.active,
});

export function QuestionEditPage() {
  const { id } = useParams();
  const questionId = id ? Number(id) : null;
  const [params] = useSearchParams();
  const existing = useQuery({ queryKey: ['question', questionId], queryFn: () => api.question(questionId!), enabled: questionId !== null });

  if (questionId && existing.isPending) return <Skeleton className="h-96 w-full max-w-3xl" />;
  if (questionId && existing.isError) return <p className="text-destructive">{errorMessage(existing.error)}</p>;

  // Mount the form only once its initial values are known: Radix Select misbehaves when its
  // value is swapped after mount (it emits onValueChange('')), which a later reset() would trigger.
  const initial: FormValues = existing.data
    ? toFormValues(existing.data)
    : {
        categoryId: Number(params.get('categoryId')) || (undefined as unknown as number),
        type: 'text', text: '', options: ['', '', '', ''], correctIndex: 0, points: 100,
        imageUrl: null, revealUrl: null, active: true,
      };
  return <QuestionForm key={questionId ?? 'new'} questionId={questionId} initial={initial} />;
}

function QuestionForm({ questionId, initial }: { questionId: number | null; initial: FormValues }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const categories = useCategories();

  const { register, control, handleSubmit, reset, trigger, formState: { errors, isDirty } } = useForm<FormValues, unknown, QuestionInput>({
    resolver: zodResolver(questionInput),
    defaultValues: initial,
  });

  const type = useWatch({ control, name: 'type' }) ?? 'text';

  const invalidate = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['questions'] }),
    queryClient.invalidateQueries({ queryKey: ['coverage'] }),
  ]);

  const save = useMutation({
    mutationFn: (values: QuestionInput) => (questionId ? api.updateQuestion(questionId, values) : api.createQuestion(values)),
    onSuccess: async (saved) => {
      await invalidate();
      queryClient.setQueryData(['question', saved.id], saved);
      toast.success(questionId ? 'تم حفظ التعديلات' : 'تمت إضافة السؤال');
      if (questionId) reset(toFormValues(saved));
      else navigate(`/admin/questions?categoryId=${saved.categoryId}`);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: () => api.deleteQuestion(questionId!),
    onSuccess: async () => {
      await invalidate();
      toast.success('تم حذف السؤال');
      navigate('/admin/questions', { replace: true });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <div className="max-w-3xl">
      <Button variant="ghost" size="sm" asChild className="mb-2 -ms-2">
        <Link to="/admin/questions"><ArrowRightIcon /> الأسئلة</Link>
      </Button>
      <PageHeader
        title={questionId ? 'تعديل سؤال' : 'سؤال جديد'}
        actions={questionId && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-destructive"><Trash2Icon /> حذف</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>حذف السؤال؟</AlertDialogTitle>
                <AlertDialogDescription>لا يمكن التراجع عن الحذف. إذا أردت إخفاءه مؤقتًا فأوقفه بدل حذفه.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={() => remove.mutate()}>حذف</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      />

      <form onSubmit={handleSubmit((v) => save.mutate(v))}>
        <Card>
          <CardContent>
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field data-invalid={!!errors.categoryId}>
                  <FieldLabel>الفئة</FieldLabel>
                  <Controller control={control} name="categoryId" render={({ field }) => (
                    <Select value={field.value ? String(field.value) : ''} onValueChange={(v) => v && field.onChange(Number(v))}>
                      <SelectTrigger aria-invalid={!!errors.categoryId}><SelectValue placeholder="اختر الفئة" /></SelectTrigger>
                      <SelectContent>
                        {categories.data?.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.icon} {c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )} />
                  <FieldError errors={[errors.categoryId]} />
                </Field>
                <Field>
                  <FieldLabel>النقاط</FieldLabel>
                  <Controller control={control} name="points" render={({ field }) => (
                    <Select value={String(field.value)} onValueChange={(v) => v && field.onChange(Number(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{POINTS.map((p) => <SelectItem key={p} value={String(p)}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                  )} />
                </Field>
                <Field>
                  <FieldLabel>النوع</FieldLabel>
                  <Controller control={control} name="type" render={({ field }) => (
                    <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{questionTypes.map((t) => <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>)}</SelectContent>
                    </Select>
                  )} />
                </Field>
              </div>

              <Field data-invalid={!!errors.text}>
                <FieldLabel htmlFor="text">نص السؤال</FieldLabel>
                <Textarea id="text" rows={2} aria-invalid={!!errors.text} {...register('text')} />
                <FieldError errors={[errors.text]} />
              </Field>

              <Field data-invalid={!!errors.options}>
                <FieldLabel>الخيارات</FieldLabel>
                <FieldDescription>اضغط على الدائرة بجانب الإجابة الصحيحة. ترتيب الخيارات هنا لا يهم، فاللعبة تخلطها.</FieldDescription>
                <Controller control={control} name="correctIndex" render={({ field }) => (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[0, 1, 2, 3].map((i) => {
                      const correct = field.value === i;
                      return (
                        <div key={i} className={cn('flex items-center gap-2 rounded-lg border p-1.5 ps-2 transition-colors', correct && 'border-emerald-500 bg-emerald-500/10')}>
                          <button
                            type="button"
                            role="radio"
                            aria-checked={correct}
                            aria-label={`الخيار ${i + 1} هو الصحيح`}
                            onClick={() => field.onChange(i)}
                            className={cn('grid size-6 shrink-0 place-items-center rounded-full border-2', correct ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-muted-foreground/40')}
                          >
                            {correct && <CheckIcon className="size-3.5" />}
                          </button>
                          <Input className="border-0 shadow-none focus-visible:ring-0" placeholder={`الخيار ${i + 1}`} aria-invalid={!!errors.options?.[i]} {...register(`options.${i}`, {
                              // Errors like "options must be unique" live on the array itself; re-check the whole group.
                              onChange: () => errors.options && void trigger('options'),
                            })} />
                        </div>
                      );
                    })}
                  </div>
                )} />
                <FieldError errors={[errors.options?.root ?? errors.options, ...(Array.isArray(errors.options) ? errors.options : [])].filter((e) => e?.message)} />
              </Field>

              {type !== 'text' && (
                <Field data-invalid={!!errors.imageUrl}>
                  <FieldLabel>{type === 'zoom' ? 'الصورة المقرّبة (تظهر مع السؤال)' : 'صورة السؤال'}</FieldLabel>
                  <Controller control={control} name="imageUrl" render={({ field }) => (
                    <ImageField value={field.value ?? null} onChange={field.onChange} invalid={!!errors.imageUrl} />
                  )} />
                  <FieldError errors={[errors.imageUrl]} />
                </Field>
              )}
              {TYPES_WITH_REVEAL.includes(type) && (
                <Field>
                  <FieldLabel>صورة الكشف (تظهر مع الإجابة)</FieldLabel>
                  <Controller control={control} name="revealUrl" render={({ field }) => <ImageField value={field.value ?? null} onChange={field.onChange} />} />
                </Field>
              )}

              <Field orientation="horizontal">
                <Controller control={control} name="active" render={({ field }) => (
                  <Switch id="active" checked={field.value} onCheckedChange={field.onChange} />
                )} />
                <FieldLabel htmlFor="active">مفعّل (يظهر في اللعبة)</FieldLabel>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
        <div className="mt-4 flex gap-2">
          <Button type="submit" disabled={save.isPending || (!!questionId && !isDirty)}>
            {save.isPending ? 'جاري الحفظ…' : questionId ? 'حفظ التعديلات' : 'إضافة السؤال'}
          </Button>
          <Button type="button" variant="ghost" asChild><Link to="/admin/questions">إلغاء</Link></Button>
        </div>
      </form>
    </div>
  );
}
