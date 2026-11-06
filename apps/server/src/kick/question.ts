import { POINTS } from '@quiz/shared';
import type { FastifyPluginAsync } from 'fastify';
import { drawQuestion, listPublicCategories } from '../game/catalog';

/** A random question for the stream game (any playable category and points level). The streamer's page keeps the answer. */
export const kickQuestionRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/kick/question', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (_req, reply) => {
    const cats = (await listPublicCategories()).filter((c) => c.playable);
    if (cats.length === 0) return reply.code(404).send({ error: 'لا توجد أسئلة' });
    for (let i = 0; i < 5; i++) {
      const cat = cats[Math.floor(Math.random() * cats.length)]!;
      const points = POINTS[Math.floor(Math.random() * POINTS.length)]!;
      const q = await drawQuestion(cat.id, points);
      if (q) return { text: q.text, options: q.options, correctIndex: q.correctIndex, points, imageUrl: q.imageUrl, categoryName: cat.name };
    }
    return reply.code(404).send({ error: 'لا توجد أسئلة' });
  });
};
