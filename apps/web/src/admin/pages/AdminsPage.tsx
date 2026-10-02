import { ADMIN_PASSWORD_MIN, type AdminAccount } from '@quiz/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRoundIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, errorMessage } from '@/lib/api';
import { PageHeader } from '../AdminLayout';
import { useMe } from '../auth';

const adminsQueryKey = ['admins'] as const;
const dateTime = new Intl.DateTimeFormat('ar-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' });
const PASSWORD_HINT = `${ADMIN_PASSWORD_MIN} أحرف على الأقل`;

export function AdminsPage() {
  const me = useMe();
  const admins = useQuery({ queryKey: adminsQueryKey, queryFn: api.admins });
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<{ kind: 'new' } | { kind: 'reset'; admin: AdminAccount } | null>(null);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: adminsQueryKey });

  const remove = useMutation({
    mutationFn: (a: AdminAccount) => api.deleteAdmin(a.id),
    onSuccess: async () => { await invalidate(); toast.success('تم حذف المشرف'); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <>
      <PageHeader
        title="المشرفون"
        description="كل مشرف يدخل لوحة التحكم بكامل الصلاحيات"
        actions={<Button onClick={() => setDialog({ kind: 'new' })}><PlusIcon /> مشرف جديد</Button>}
      />
      <Card className="mb-8 overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>البريد</TableHead>
              <TableHead>أُضيف</TableHead>
              <TableHead>آخر دخول</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {admins.isPending && <TableRow><TableCell colSpan={4}><Skeleton className="h-16 w-full" /></TableCell></TableRow>}
            {admins.data?.map((a) => {
              const isMe = a.id === me.data?.id;
              return (
                <TableRow key={a.id}>
                  <TableCell dir="ltr" className="text-end font-medium">
                    {isMe && <Badge variant="secondary" className="me-2">أنت</Badge>}
                    {a.email}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{dateTime.format(new Date(a.createdAt))}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.lastLoginAt ? dateTime.format(new Date(a.lastLoginAt)) : 'لم يدخل بعد'}</TableCell>
                  <TableCell>
                    {!isMe && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => setDialog({ kind: 'reset', admin: a })} aria-label="تغيير كلمة المرور" title="تغيير كلمة المرور">
                          <KeyRoundIcon />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon-sm" className="text-destructive" aria-label="حذف" title="حذف"><Trash2Icon /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>حذف المشرف {a.email}؟</AlertDialogTitle>
                              <AlertDialogDescription>يخرج من لوحة التحكم فورًا ولا يستطيع الدخول مرة أخرى.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction variant="destructive" onClick={() => remove.mutate(a)}>حذف</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <OwnPasswordCard />

      {dialog?.kind === 'new' && <NewAdminDialog onClose={() => setDialog(null)} onSaved={invalidate} />}
      {dialog?.kind === 'reset' && <ResetPasswordDialog admin={dialog.admin} onClose={() => setDialog(null)} />}
    </>
  );
}

function NewAdminDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => Promise<unknown> }) {
  const create = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => api.createAdmin(email, password),
    onSuccess: async (a) => { await onSaved(); toast.success(`تمت إضافة ${a.email}`); onClose(); },
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>مشرف جديد</DialogTitle>
          <DialogDescription>أرسل له البريد وكلمة المرور، ويغيّرها بنفسه بعد أول دخول.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            create.mutate({ email: String(form.get('email')), password: String(form.get('password')) });
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="new-email">البريد الإلكتروني</FieldLabel>
              <Input id="new-email" name="email" type="email" dir="ltr" autoComplete="off" required autoFocus />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-password">كلمة المرور</FieldLabel>
              <Input id="new-password" name="password" type="text" dir="ltr" autoComplete="new-password" minLength={ADMIN_PASSWORD_MIN} required />
              <FieldDescription>{PASSWORD_HINT}</FieldDescription>
            </Field>
            {create.isError && <FieldError>{errorMessage(create.error)}</FieldError>}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? 'جاري الإضافة…' : 'إضافة'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ admin, onClose }: { admin: AdminAccount; onClose: () => void }) {
  const reset = useMutation({
    mutationFn: (password: string) => api.resetAdminPassword(admin.id, password),
    onSuccess: () => { toast.success('تم تغيير كلمة المرور'); onClose(); },
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>كلمة مرور جديدة</DialogTitle>
          <DialogDescription dir="ltr" className="text-end">{admin.email}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            reset.mutate(String(new FormData(e.currentTarget).get('password')));
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="reset-password">كلمة المرور الجديدة</FieldLabel>
              <Input id="reset-password" name="password" type="text" dir="ltr" autoComplete="new-password" minLength={ADMIN_PASSWORD_MIN} required autoFocus />
              <FieldDescription>{PASSWORD_HINT}</FieldDescription>
            </Field>
            {reset.isError && <FieldError>{errorMessage(reset.error)}</FieldError>}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
            <Button type="submit" disabled={reset.isPending}>حفظ</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function OwnPasswordCard() {
  const change = useMutation({
    mutationFn: ({ current, next }: { current: string; next: string }) => api.changeOwnPassword(current, next),
    onSuccess: () => toast.success('تم تغيير كلمة المرور'),
  });
  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>كلمة مرورك</CardTitle>
        <CardDescription>غيّر كلمة المرور التي تدخل بها</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const data = new FormData(form);
            change.mutate({ current: String(data.get('current')), next: String(data.get('next')) }, { onSuccess: () => form.reset() });
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="current-password">كلمة المرور الحالية</FieldLabel>
              <Input id="current-password" name="current" type="password" dir="ltr" autoComplete="current-password" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="next-password">كلمة المرور الجديدة</FieldLabel>
              <Input id="next-password" name="next" type="password" dir="ltr" autoComplete="new-password" minLength={ADMIN_PASSWORD_MIN} required />
              <FieldDescription>{PASSWORD_HINT}</FieldDescription>
            </Field>
            {change.isError && <FieldError>{errorMessage(change.error)}</FieldError>}
            <Button type="submit" disabled={change.isPending} className="self-start">تغيير كلمة المرور</Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
