import { POINTS, type PublicCategory } from '@quiz/shared';
import { and, asc, countDistinct, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { categories, questions } from '../db/schema';
import { shuffleQuestion, type DealtQuestion } from './room';

/** Active categories; `playable` = at least one active question at every points level, so a full board column can be dealt. */
export async function listPublicCategories(ids?: number[]): Promise<PublicCategory[]> {
  const rows = await db
    .select({ id: categories.id, slug: categories.slug, name: categories.name, icon: categories.icon, levels: countDistinct(questions.points) })
    .from(categories)
    .leftJoin(questions, and(eq(questions.categoryId, categories.id), eq(questions.active, true)))
    .where(ids ? and(eq(categories.active, true), inArray(categories.id, ids)) : eq(categories.active, true))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder), asc(categories.id));
  return rows.map(({ levels, ...c }) => ({ ...c, playable: levels === POINTS.length }));
}

/** A random active question for one board cell, with its options shuffled. */
export async function drawQuestion(categoryId: number, points: number): Promise<DealtQuestion | null> {
  const [q] = await db
    .select({
      id: questions.id,
      type: questions.type,
      text: questions.text,
      options: questions.options,
      correctIndex: questions.correctIndex,
      imageUrl: questions.imageUrl,
      revealUrl: questions.revealUrl,
    })
    .from(questions)
    .where(and(eq(questions.categoryId, categoryId), eq(questions.points, points), eq(questions.active, true)))
    .orderBy(sql`random()`)
    .limit(1);
  return q ? shuffleQuestion(q) : null;
}
