import { and, asc, count, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { db } from '../../db/client';
import { categories, questions } from '../../db/schema';

export async function adminStatsRoutes(app: FastifyInstance) {
  // Active question count per category × points level, to spot gaps on the board.
  app.get('/coverage', async () => {
    const rows = await db
      .select({ categoryId: categories.id, slug: categories.slug, name: categories.name, points: questions.points, n: count(questions.id) })
      .from(categories)
      .leftJoin(questions, and(eq(questions.categoryId, categories.id), eq(questions.active, true)))
      .groupBy(categories.id, questions.points)
      .orderBy(asc(categories.sortOrder), asc(categories.id));

    const byCat = new Map<number, { categoryId: number; slug: string; name: string; counts: Record<number, number> }>();
    for (const r of rows) {
      const entry = byCat.get(r.categoryId) ?? { categoryId: r.categoryId, slug: r.slug, name: r.name, counts: {} };
      if (r.points != null) entry.counts[r.points] = r.n;
      byCat.set(r.categoryId, entry);
    }
    return [...byCat.values()];
  });
}
