import type { TourQuestion } from '@quiz/shared';
import { POINTS } from '@quiz/shared';
import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../../db/client';
import { tourRuns } from '../../db/schema';
import { drawQuestion } from '../../game/catalog';
import { statsToday } from '../../game/usage';

const questionQuery = z.object({ category: z.coerce.number().int().positive(), points: z.coerce.number().int().refine((p) => (POINTS as readonly number[]).includes(p)) });
const eventBody = z.object({ step: z.enum(['open', 'finish', 'play']) });

/** «اكتشف طريقة اللعب»: a real question from the bank for the tour's board, and its open/finish counters. */
export async function tourRoutes(app: FastifyInstance) {
  app.get('/question', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply): Promise<TourQuestion | void> => {
    const q = questionQuery.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: 'طلب غير صالح' });
    // A text question reads best in the tour; try a few draws before taking any type.
    let picked = null;
    for (let i = 0; i < 4 && (!picked || picked.type !== 'text'); i++) picked = (await drawQuestion(q.data.category, q.data.points)) ?? picked;
    if (!picked) return reply.code(404).send({ error: 'ما فيه سؤال لهذي الخانة' });
    return { text: picked.text, options: picked.options, correctIndex: picked.correctIndex, points: q.data.points, type: picked.type, imageUrl: picked.imageUrl ?? null };
  });
  app.post('/event', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const b = eventBody.safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: 'طلب غير صالح' });
    await db
      .insert(tourRuns)
      .values({ day: statsToday, step: b.data.step, count: 1 })
      .onConflictDoUpdate({ target: [tourRuns.day, tourRuns.step], set: { count: sql`${tourRuns.count} + 1` } });
    return { ok: true };
  });
}
