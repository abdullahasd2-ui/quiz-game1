import { z } from 'zod';
import { POINTS } from './rules';

/** Legacy questions whose image was drawn on a canvas by the old client and still need a real upload. */
export const LEGACY_DRAW_PREFIX = 'legacy-draw:';

export const questionTypes = ['text', 'image', 'reveal', 'zoom'] as const;
export type QuestionType = (typeof questionTypes)[number];

export const categoryInput = z.object({
  slug: z.string().trim().min(1, 'اكتب المعرّف').max(40, 'المعرّف أطول من 40 حرفًا').regex(/^[a-z0-9-]+$/, 'المعرّف: حروف إنجليزية صغيرة وأرقام و «-» فقط'),
  name: z.string().trim().min(1, 'اكتب الاسم').max(60, 'الاسم أطول من 60 حرفًا'),
  icon: z.string().trim().min(1, 'اختر أيقونة').max(16, 'الأيقونة طويلة جدًا'),
  sortOrder: z.number({ error: 'الترتيب يجب أن يكون رقمًا' }).int('الترتيب يجب أن يكون رقمًا صحيحًا').default(0),
  active: z.boolean().default(true),
});
export type CategoryInput = z.infer<typeof categoryInput>;

const POINTS_MESSAGE = `النقاط يجب أن تكون ${POINTS.join(' أو ')}`;

export const questionInput = z
  .object({
    categoryId: z.number({ error: 'اختر الفئة' }).int().positive('اختر الفئة'),
    type: z.enum(questionTypes, { error: `النوع يجب أن يكون: ${questionTypes.join(', ')}` }).default('text'),
    text: z.string().trim().min(1, 'اكتب نص السؤال').max(500, 'نص السؤال أطول من 500 حرف'),
    options: z.array(z.string().trim().min(1, 'الخيار فارغ').max(120, 'الخيار أطول من 120 حرفًا')).length(4, 'يجب أن تكون 4 خيارات'),
    correctIndex: z.number({ error: 'حدد الإجابة الصحيحة' }).int().min(0, 'حدد الإجابة الصحيحة (1 إلى 4)').max(3, 'حدد الإجابة الصحيحة (1 إلى 4)'),
    points: z.number({ error: POINTS_MESSAGE }).int(POINTS_MESSAGE).refine((p) => (POINTS as readonly number[]).includes(p), POINTS_MESSAGE),
    imageUrl: z.string().max(1000).nullable().default(null),
    revealUrl: z.string().max(1000).nullable().default(null),
    active: z.boolean().default(true),
  })
  .refine((q) => q.type === 'text' || q.imageUrl, { message: 'الصورة مطلوبة لهذا النوع', path: ['imageUrl'] })
  .refine((q) => new Set(q.options).size === q.options.length, { message: 'الخيارات يجب أن تكون مختلفة', path: ['options'] })
  .refine((q) => !(q.active && q.imageUrl?.startsWith(LEGACY_DRAW_PREFIX)), { message: 'ارفع صورة حقيقية قبل التفعيل', path: ['imageUrl'] });
export type QuestionInput = z.infer<typeof questionInput>;

export const questionListQuery = z.object({
  categoryId: z.coerce.number().int().positive().optional(),
  search: z.string().trim().max(100).optional(),
  active: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const loginInput = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('بريد إلكتروني غير صالح')),
  password: z.string().min(1, 'اكتب كلمة المرور'),
});

/** Arabic labels for field paths, used when listing validation issues. */
export const FIELD_LABELS: Record<string, string> = {
  categoryId: 'الفئة', categorySlug: 'الفئة', type: 'النوع', text: 'نص السؤال', options: 'الخيارات',
  correctIndex: 'الإجابة الصحيحة', points: 'النقاط', imageUrl: 'الصورة', revealUrl: 'صورة الكشف', active: 'التفعيل',
  slug: 'المعرّف', name: 'الاسم', icon: 'الأيقونة', sortOrder: 'الترتيب',
};

/** "options.2" → "الخيارات 3" */
export function fieldLabel(path: string): string {
  const [head = '', index] = path.split('.');
  const label = FIELD_LABELS[head] ?? head;
  return index !== undefined && /^\d+$/.test(index) ? `${label} ${Number(index) + 1}` : label;
}
