import { POINTS } from '@quiz/shared';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { drawQuestion, listPublicCategories } from '../game/catalog';
import { MANA } from './packs/mana';

/** Team packs by their code (given to the team; anyone with it can open the pack, answers included). */
const PACKS = [MANA];

const query = z.object({ category: z.coerce.number().int().positive(), points: z.coerce.number().refine((p) => (POINTS as readonly number[]).includes(p)) });

/** The question of one board cell for the stream game. The streamer's page keeps the answer. */
export const kickQuestionRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/kick/question', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    const parsed = query.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: 'طلب غير صالح' });
    const { category, points } = parsed.data;
    const [cat] = await listPublicCategories([category]);
    const q = cat && (await drawQuestion(category, points));
    if (!q) return reply.code(404).send({ error: 'لا يوجد سؤال لهذه الخانة' });
    return { type: q.type, revealUrl: q.revealUrl, text: q.text, options: q.options, correctIndex: q.correctIndex, points, imageUrl: q.imageUrl, categoryName: cat.name };
  });

  app.get<{ Params: { code: string } }>('/api/kick/pack/:code', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const code = String(req.params.code ?? '').trim().toUpperCase();
    const pack = PACKS.find((p) => p.code === code);
    if (!pack) return reply.code(404).send({ error: 'الكود غير صحيح' });
    return pack;
  });
};
