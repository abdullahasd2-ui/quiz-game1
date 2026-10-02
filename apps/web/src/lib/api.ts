import { fieldLabel, type Admin, type AdminAccount, type LiveStats, type UsageStats, type ApiErrorBody, type Category, type CategoryInput, type CoverageRow, type Page, type PublicCategory, type Question, type QuestionInput, type QuestionStatus } from '@quiz/shared';
import { serverUrl } from './server';

export class ApiError extends Error {
  constructor(public status: number, public body: ApiErrorBody) {
    super(body.error);
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const isForm = body instanceof FormData;
  const res = await fetch(serverUrl(url), {
    method,
    credentials: 'same-origin',
    headers: body && !isForm ? { 'content-type': 'application/json' } : undefined,
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw new ApiError(res.status, data as ApiErrorBody);
  return data as T;
}

export type QuestionFilters = { categoryId?: number; search?: string; active?: boolean; status?: QuestionStatus; points?: number; page?: number; pageSize?: number };
export type ImportItem = Omit<QuestionInput, 'categoryId'> & { categorySlug: string };

const qs = (params: Record<string, unknown>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') s.set(k, String(v));
  const str = s.toString();
  return str ? `?${str}` : '';
};

export const api = {
  publicCategories: () => request<PublicCategory[]>('GET', '/api/categories'),

  me: () => request<Admin>('GET', '/api/admin/me'),
  login: (email: string, password: string) => request<Admin>('POST', '/api/admin/login', { email, password }),
  logout: () => request<{ ok: true }>('POST', '/api/admin/logout'),

  categories: () => request<Category[]>('GET', '/api/admin/categories'),
  createCategory: (input: CategoryInput) => request<Category>('POST', '/api/admin/categories', input),
  updateCategory: (id: number, input: Partial<CategoryInput>) => request<Category>('PATCH', `/api/admin/categories/${id}`, input),
  deleteCategory: (id: number) => request<void>('DELETE', `/api/admin/categories/${id}`),

  questions: (f: QuestionFilters) => request<Page<Question>>('GET', `/api/admin/questions${qs(f)}`),
  question: (id: number) => request<Question>('GET', `/api/admin/questions/${id}`),
  createQuestion: (input: QuestionInput) => request<Question>('POST', '/api/admin/questions', input),
  updateQuestion: (id: number, input: Partial<QuestionInput>) => request<Question>('PATCH', `/api/admin/questions/${id}`, input),
  deleteQuestion: (id: number) => request<void>('DELETE', `/api/admin/questions/${id}`),
  importQuestions: (questions: ImportItem[], opts: { status?: 'approved' | 'pending'; source?: string } = {}) =>
    request<{ inserted: number; skipped: number }>('POST', '/api/admin/questions/import', { questions, ...opts }),
  reviewQuestions: (ids: number[], status: QuestionStatus) => request<{ updated: number }>('POST', '/api/admin/questions/review', { ids, status }),

  upload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<{ url: string }>('POST', '/api/admin/upload', form);
  },
  coverage: () => request<CoverageRow[]>('GET', '/api/admin/stats/coverage'),
  live: () => request<LiveStats>('GET', '/api/admin/stats/live'),
  usage: (days: number) => request<UsageStats>('GET', `/api/admin/stats/usage?days=${days}`),

  admins: () => request<AdminAccount[]>('GET', '/api/admin/admins'),
  createAdmin: (email: string, password: string) => request<AdminAccount>('POST', '/api/admin/admins', { email, password }),
  resetAdminPassword: (id: number, password: string) => request<AdminAccount>('PUT', `/api/admin/admins/${id}/password`, { password }),
  deleteAdmin: (id: number) => request<void>('DELETE', `/api/admin/admins/${id}`),
  changeOwnPassword: (currentPassword: string, password: string) =>
    request<{ ok: true }>('POST', '/api/admin/me/password', { currentPassword, password }),
};

/** Human-readable message for a failed request, including field-level validation issues. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 409 && err.body.error === 'Already exists') return 'موجود مسبقًا (المعرّف مكرر)';
    if (err.status === 409 && err.body.error === 'Still referenced by other records') return 'لا يمكن الحذف: مرتبط ببيانات أخرى';
    if (err.body.issues?.length) return err.body.issues.map((i) => (i.path ? `${fieldLabel(i.path)}: ${i.message}` : i.message)).join('، ');
    return err.body.error;
  }
  return 'تعذّر الاتصال بالسيرفر';
}
