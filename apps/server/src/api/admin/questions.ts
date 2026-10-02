import { fieldLabel, questionInput, questionListQuery } from '@quiz/shared';
import { and, asc, count, desc, eq, ilike, inArray, type SQL } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../../db/client';
import { categories, questions } from '../../db/schema';
import { HttpError, notFound } from '../../lib/errors';

const idParam = z.object({ id: z.coerce.number().int().positive() });

// `questionInput` has refinements, so partial updates are validated by merging onto the stored row.
const questionPatch = z.record(z.string(), z.unknown());

const importItem = z.object({ categorySlug: z.string() }).passthrough();
const importBody = z.object({ questions: z.array(importItem).min(1).max(500) });

export async function adminQuestionRoutes(app: FastifyInstance) {
  app.get('/', async (req) => {
    const q = questionListQuery.parse(req.query);
    const filters: SQL[] = [];
    if (q.categoryId) filters.push(eq(questions.categoryId, q.categoryId));
    if (q.active !== undefined) filters.push(eq(questions.active, q.active));
    if (q.search) filters.push(ilike(questions.text, `%${q.search.replace(/[%_\\]/g, '\\$&')}%`));
    const where = filters.length ? and(...filters) : undefined;

    const [items, [total]] = await Promise.all([
      db
        .select()
        .from(questions)
        .where(where)
        .orderBy(asc(questions.categoryId), asc(questions.points), desc(questions.id))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      db.select({ value: count() }).from(questions).where(where),
    ]);
    return { items, total: total?.value ?? 0, page: q.page, pageSize: q.pageSize };
  });

  app.get('/:id', async (req) => {
    const { id } = idParam.parse(req.params);
    const [row] = await db.select().from(questions).where(eq(questions.id, id));
    if (!row) throw notFound('Question not found');
    return row;
  });

  app.post('/', async (req, reply) => {
    const [row] = await db.insert(questions).values(questionInput.parse(req.body)).returning();
    return reply.status(201).send(row);
  });

  app.patch('/:id', async (req) => {
    const { id } = idParam.parse(req.params);
    const [current] = await db.select().from(questions).where(eq(questions.id, id));
    if (!current) throw notFound('Question not found');
    const { id: _id, createdAt: _c, updatedAt: _u, ...editable } = current;
    const next = questionInput.parse({ ...editable, ...questionPatch.parse(req.body) });
    const [row] = await db.update(questions).set(next).where(eq(questions.id, id)).returning();
    return row;
  });

  app.delete('/:id', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const [row] = await db.delete(questions).where(eq(questions.id, id)).returning({ id: questions.id });
    if (!row) throw notFound('Question not found');
    return reply.status(204).send();
  });

  // All-or-nothing bulk import; each item names its category by slug.
  app.post('/import', async (req, reply) => {
    const body = importBody.parse(req.body);
    const slugs = [...new Set(body.questions.map((q) => q.categorySlug))];
    const cats = await db.select({ id: categories.id, slug: categories.slug }).from(categories).where(inArray(categories.slug, slugs));
    const idBySlug = new Map(cats.map((c) => [c.slug, c.id]));

    const rows = body.questions.map((item, i) => {
      const { categorySlug, ...rest } = item;
      const categoryId = idBySlug.get(categorySlug);
      if (!categoryId) throw new HttpError(400, `السطر ${i + 1}: فئة غير معروفة «${categorySlug}»`);
      const parsed = questionInput.safeParse({ ...rest, categoryId });
      if (!parsed.success) throw new HttpError(400, `السطر ${i + 1}: ${parsed.error.issues.map((x) => `${fieldLabel(x.path.join('.'))}: ${x.message}`).join('، ')}`);
      return parsed.data;
    });
    const inserted = await db.insert(questions).values(rows).returning({ id: questions.id });
    return reply.status(201).send({ inserted: inserted.length });
  });
}
