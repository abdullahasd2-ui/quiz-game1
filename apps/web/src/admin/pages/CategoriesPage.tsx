import { zodResolver } from '@hookform/resolvers/zod';
import { categoryInput, POINTS, type Category, type CategoryInput } from '@quiz/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { toast } from 'sonner';
import type { z } from 'zod';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, errorMessage } from '@/lib/api';
import { PageHeader } from '../AdminLayout';
import { categoriesQueryKey, useCategories } from '../useCategories';

export function CategoriesPage() {
  const categories = useCategories();
  const coverage = useQuery({ queryKey: ['coverage'], queryFn: api.coverage });
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Category | 'new' | null>(null);

  const countsById = new Map((coverage.data ?? []).map((r) => [r.categoryId, r.counts]));
  const invalidate = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: categoriesQueryKey }),
    queryClient.invalidateQueries({ queryKey: ['coverage'] }),
  ]);

  const toggle = useMutation({
    mutationFn: (c: Category) => api.updateCategory(c.id, { active: !c.active }),
    onSuccess: invalidate,
    onError: (err) => toast.error(errorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: (c: Category) => api.deleteCategory(c.id),
    onSuccess: async () => { await invalidate(); toast.success('تم حذف الفئة'); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <>
      <PageHeader title="الفئات" actions={<Button onClick={() => setEditing('new')}><PlusIcon /> فئة جديدة</Button>} />
      <Card className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12" />
              <TableHead>الاسم</TableHead>
              <TableHead>المعرّف</TableHead>
              <TableHead className="text-center">الأسئلة المفعّلة</TableHead>
              <TableHead className="text-center">الترتيب</TableHead>
              <TableHead>مفعّلة</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.isPending && <TableRow><TableCell colSpan={7}><Skeleton className="h-24 w-full" /></TableCell></TableRow>}
            {categories.data?.map((c) => {
              const counts = countsById.get(c.id) ?? {};
              const total = Object.values(counts).reduce((a, b) => a + b, 0);
              const playable = POINTS.every((p) => (counts[p] ?? 0) > 0);
              return (
                <TableRow key={c.id}>
                  <TableCell className="text-xl">{c.icon}</TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell dir="ltr" className="text-end font-mono text-xs text-muted-foreground">{c.slug}</TableCell>
                  <TableCell className="text-center">
                    <Link to={`/admin/questions?categoryId=${c.id}`} className="tabular-nums hover:underline">{total}</Link>
                    {!playable && <Badge variant="destructive" className="ms-2">ناقصة</Badge>}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">{c.sortOrder}</TableCell>
                  <TableCell>
                    <Switch checked={c.active} onCheckedChange={() => toggle.mutate(c)} aria-label={`تفعيل ${c.name}`} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => setEditing(c)} aria-label="تعديل"><PencilIcon /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon-sm" className="text-destructive" aria-label="حذف"><Trash2Icon /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>حذف فئة «{c.name}»؟</AlertDialogTitle>
                            <AlertDialogDescription>
                              لا يمكن حذف فئة فيها أسئلة. احذف أسئلتها أو انقلها أولًا، أو أوقف الفئة بدل حذفها.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                            <AlertDialogAction variant="destructive" onClick={() => remove.mutate(c)}>حذف</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
      {editing && (
        <CategoryDialog
          category={editing === 'new' ? null : editing}
          nextSortOrder={(categories.data?.length ?? 0)}
          onClose={() => setEditing(null)}
          onSaved={invalidate}
        />
      )}
    </>
  );
}

type FormValues = z.input<typeof categoryInput>;

function CategoryDialog({ category, nextSortOrder, onClose, onSaved }: {
  category: Category | null; nextSortOrder: number; onClose: () => void; onSaved: () => Promise<unknown>;
}) {
  const { register, control, handleSubmit, formState: { errors } } = useForm<FormValues, unknown, CategoryInput>({
    resolver: zodResolver(categoryInput),
    defaultValues: category
      ? { slug: category.slug, name: category.name, icon: category.icon, sortOrder: category.sortOrder, active: category.active }
      : { slug: '', name: '', icon: '', sortOrder: nextSortOrder, active: true },
  });
  const save = useMutation({
    mutationFn: (v: CategoryInput) => (category ? api.updateCategory(category.id, v) : api.createCategory(v)),
    onSuccess: async () => { await onSaved(); toast.success(category ? 'تم حفظ الفئة' : 'تمت إضافة الفئة'); onClose(); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{category ? 'تعديل فئة' : 'فئة جديدة'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit((v) => save.mutate(v))}>
          <FieldGroup>
            <div className="grid grid-cols-[1fr_5rem] gap-3">
              <Field data-invalid={!!errors.name}>
                <FieldLabel htmlFor="name">الاسم</FieldLabel>
                <Input id="name" autoFocus aria-invalid={!!errors.name} {...register('name')} />
                <FieldError errors={[errors.name]} />
              </Field>
              <Field data-invalid={!!errors.icon}>
                <FieldLabel htmlFor="icon">الأيقونة</FieldLabel>
                <Input id="icon" className="text-center text-lg" placeholder="⚽" aria-invalid={!!errors.icon} {...register('icon')} />
                <FieldError errors={[errors.icon]} />
              </Field>
            </div>
            <Field data-invalid={!!errors.slug}>
              <FieldLabel htmlFor="slug">المعرّف</FieldLabel>
              <Input id="slug" dir="ltr" placeholder="football" aria-invalid={!!errors.slug} {...register('slug')} />
              <FieldDescription>بالإنجليزي: حروف صغيرة وأرقام و «-». يُستخدم في ملفات الاستيراد.</FieldDescription>
              <FieldError errors={[errors.slug]} />
            </Field>
            <div className="grid grid-cols-2 items-end gap-3">
              <Field>
                <FieldLabel htmlFor="sortOrder">الترتيب</FieldLabel>
                <Input id="sortOrder" type="number" {...register('sortOrder', { valueAsNumber: true })} />
              </Field>
              <Field orientation="horizontal" className="pb-2">
                <Controller control={control} name="active" render={({ field }) => (
                  <Switch id="cat-active" checked={field.value} onCheckedChange={field.onChange} />
                )} />
                <FieldLabel htmlFor="cat-active">مفعّلة</FieldLabel>
              </Field>
            </div>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={save.isPending}>{save.isPending ? 'جاري الحفظ…' : 'حفظ'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
