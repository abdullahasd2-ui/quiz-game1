import type { Popular } from '@quiz/shared';
import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { db } from '../../db/client';

/** How far back «الأكثر لعبًا» looks, and how long an answer is reused. */
const DAYS = 30;
const CACHE_MS = 10 * 60_000;
let cached: { at: number; data: Popular } | null = null;

/**
 * What players pick most — only the order, no numbers — so the game can mark it «🔥 الأكثر لعبًا».
 * Main game: modes and categories of started games. Stream: the modes streams played.
 */
export async function popular(): Promise<Popular> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.data;
  const rows = <T>(q: ReturnType<typeof sql>) => db.execute(q) as unknown as Promise<T[]>;
  const [variants, categories, stream] = await Promise.all([
    rows<{ variant: string }>(sql`
      select variant from games where started_at is not null and created_at > now() - make_interval(days => ${DAYS})
      group by variant order by count(*) desc`),
    rows<{ id: number }>(sql`
      select picked.id::int as "id" from games g cross join lateral jsonb_array_elements_text(g.category_ids) as picked(id)
      where g.started_at is not null and g.created_at > now() - make_interval(days => ${DAYS})
      group by picked.id order by count(*) desc limit 3`),
    rows<{ variant: string }>(sql`
      select variant from kick_streams where not test and variant is not null and game_started_at is not null
        and started_at > now() - make_interval(days => ${DAYS})
      group by variant order by count(*) desc`),
  ]);
  const data: Popular = {
    variants: variants.map((r) => r.variant) as Popular['variants'],
    categories: categories.map((r) => r.id),
    streamVariants: stream.map((r) => r.variant) as Popular['streamVariants'],
  };
  cached = { at: Date.now(), data };
  return data;
}

export async function popularRoutes(app: FastifyInstance) {
  app.get('/', () => popular());
}
