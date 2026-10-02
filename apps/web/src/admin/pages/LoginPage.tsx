import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { api, ApiError } from '@/lib/api';
import { meQueryKey } from '../auth';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    try {
      const admin = await api.login(String(form.get('email')), String(form.get('password')));
      queryClient.setQueryData(meQueryKey, admin);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? '/admin', { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401 ? 'البريد أو كلمة المرور غير صحيحة'
        : err instanceof ApiError && err.status === 429 ? 'محاولات كثيرة، حاول بعد قليل'
        : 'تعذّر الاتصال بالسيرفر',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid min-h-svh place-items-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">تسجيل الدخول</CardTitle>
          <CardDescription>لوحة تحكم «جاوب أو بادل»</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">البريد الإلكتروني</FieldLabel>
                <Input id="email" name="email" type="email" dir="ltr" autoComplete="username" required autoFocus />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">كلمة المرور</FieldLabel>
                <Input id="password" name="password" type="password" dir="ltr" autoComplete="current-password" required />
              </Field>
              {error && <FieldError>{error}</FieldError>}
              <Button type="submit" disabled={pending}>{pending ? 'جاري الدخول…' : 'دخول'}</Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
