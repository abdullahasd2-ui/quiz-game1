import { POINTS, type QuestionPack } from '@quiz/shared';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { drawQuestion, listPublicCategories } from '../game/catalog';
import { LIST_CATEGORIES, LIST_LETTERS, LIST_LEVELS, listBank, weightedPick } from './lists/bank';

/** Team packs by their code (given to the team; anyone with it can open the pack, answers included). */
const PACKS: QuestionPack[] = [];

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

  // «عدّها»: the categories, then one random question at a time (skipping the ones already played this stream).
  app.get('/api/kick/lists/categories', async () => {
    const bank = listBank();
    return LIST_CATEGORIES.map((c) => ({ ...c, count: bank.filter((q) => (c.id === 'letters' ? !!q.letter : q.cat === c.id)).length }));
  });
  app.get('/api/kick/lists/levels', async () => {
    const bank = listBank();
    return LIST_LEVELS.map((l) => ({ ...l, count: bank.filter((q) => q.level === l.id).length }));
  });
  // «حروف»: how many questions each letter has (in the chosen levels), for the letter grid.
  app.post<{ Body: { levels?: unknown; exclude?: unknown } }>('/api/kick/lists/letters', async (req) => {
    const levels = Array.isArray(req.body?.levels) ? req.body.levels.map(String) : [];
    const exclude = new Set(Array.isArray(req.body?.exclude) ? req.body.exclude.map(String).slice(0, 2000) : []);
    const pool = listBank().filter((q) => q.letter && (levels.length === 0 || levels.includes(q.level)) && !exclude.has(q.id));
    return LIST_LETTERS.map((l) => ({ letter: l, count: pool.filter((q) => q.letter === l).length }));
  });
  app.post<{ Body: { cats?: unknown; levels?: unknown; exclude?: unknown; letter?: unknown } }>('/api/kick/lists/next', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    const cats = Array.isArray(req.body?.cats) ? req.body.cats.map(String) : [];
    const exclude = new Set(Array.isArray(req.body?.exclude) ? req.body.exclude.map(String).slice(0, 2000) : []);
    const levels = Array.isArray(req.body?.levels) ? req.body.levels.map(String) : [];
    const letter = typeof req.body?.letter === 'string' ? req.body.letter : '';
    // A question's group: its category, or «حروف» for a letter question when «حروف» is chosen (and always when a letter is asked for).
    const group = (q: { cat: string; letter?: string }) => (q.letter && (letter || cats.includes('letters')) ? 'letters' : q.cat);
    const pool = listBank().filter(
      (q) =>
        (letter ? q.letter === letter : cats.length === 0 || cats.includes(q.cat) || (cats.includes('letters') && !!q.letter)) &&
        (levels.length === 0 || levels.includes(q.level)) &&
        !exclude.has(q.id),
    );
    if (!pool.length) return reply.code(404).send({ error: letter ? `خلصت أسئلة حرف «${letter}»` : 'خلصت الأسئلة' });
    if (letter) {
      // A chosen letter: rather a list people can name a lot from («لاعبين كورة», «دول»…) than a narrow one.
      const easier = pool.filter((q) => q.level !== 'hard');
      const from = easier.length ? easier : pool;
      let r = Math.random() * from.reduce((n, q) => n + q.answers.length, 0);
      const q = from.find((x) => (r -= x.answers.length) < 0) ?? from[0]!;
      return { ...q, cat: 'letters' };
    }
    // Each chosen category gets an equal chance, however many questions it has (football alone has the most).
    const left = [...new Set(pool.map(group))];
    const cat = left[Math.floor(Math.random() * left.length)];
    const inCat = pool.filter((q) => group(q) === cat);
    // Saudi, Gulf and Arab topics (and easy questions) come up more often.
    const q = weightedPick(inCat)!;
    return group(q) === 'letters' ? { ...q, cat: 'letters' } : q;
  });
};
