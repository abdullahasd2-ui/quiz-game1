import { fieldLabel, normalizeQuestionText, questionInput, type QuestionInput, type QuestionStatus } from '@quiz/shared';
import { inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client';
import { categories, questions } from '../db/schema';
import { HttpError } from './errors';

// One question as it appears in an import file: the category is named by slug.
export const importItem = z.object({ categorySlug: z.string() }).passthrough();
export type ImportItem = z.infer<typeof importItem>;

type ImportOptions = { status: QuestionStatus; source?: string | null };

/**
 * Validates every item (all-or-nothing) and inserts them. Proposals (`pending`) skip questions whose
 * text already exists in the same category, in any status, so re-loading a file or a rejected question
 * coming back from the generator adds nothing.
 */
export async function importQuestions(items: ImportItem[], { status, source = null }: ImportOptions) {
  const slugs = [...new Set(items.map((q) => q.categorySlug))];
  const cats = slugs.length ? await db.select({ id: categories.id, slug: categories.slug }).from(categories).where(inArray(categories.slug, slugs)) : [];
  const idBySlug = new Map(cats.map((c) => [c.slug, c.id]));

  const rows: QuestionInput[] = items.map((item, i) => {
    const { categorySlug, ...rest } = item;
    const categoryId = idBySlug.get(categorySlug);
    if (!categoryId) throw new HttpError(400, `السطر ${i + 1}: فئة غير معروفة «${categorySlug}»`);
    const parsed = questionInput.safeParse({ ...rest, categoryId });
    if (!parsed.success) throw new HttpError(400, `السطر ${i + 1}: ${parsed.error.issues.map((x) => `${fieldLabel(x.path.join('.'))}: ${x.message}`).join('، ')}`);
    return parsed.data;
  });

  let toInsert = rows;
  if (status === 'pending') {
    const categoryIds = [...new Set(rows.map((r) => r.categoryId))];
    const existing = await db.select({ categoryId: questions.categoryId, text: questions.text }).from(questions).where(inArray(questions.categoryId, categoryIds));
    const seen = new Set(existing.map((q) => `${q.categoryId}:${normalizeQuestionText(q.text)}`));
    toInsert = rows.filter((r) => {
      const key = `${r.categoryId}:${normalizeQuestionText(r.text)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const inserted = toInsert.length
    ? await db.insert(questions).values(toInsert.map((r) => ({ ...r, status, source }))).returning({ id: questions.id })
    : [];
  return { inserted: inserted.length, skipped: rows.length - inserted.length };
}
